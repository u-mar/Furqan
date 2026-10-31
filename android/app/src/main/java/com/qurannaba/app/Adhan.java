package com.qurannaba.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The adhan with the app closed. The site works out the coming weeks' prayer times on the phone
 * (lib/native-adhan.ts) and hands them over (NabaAdhanPlugin); they are kept here, and Android is
 * asked to wake the app at the next one (AlarmManager, AdhanReceiver). A notification then sounds
 * the adhan: the full recording, and for Fajr its opening takbir only, since the recording is
 * not the Fajr adhan. Tapping the notification, swiping it away or its Stop button ends the sound.
 * Like any notification it stays quiet when the phone is on silent or Do Not Disturb.
 */
final class Adhan {

    static final String ACTION_SOUND = "com.qurannaba.app.ADHAN";
    static final String ACTION_STOP = "com.qurannaba.app.ADHAN_STOP";
    static final String EXTRA_AT = "at";

    /** Android keeps a channel's sound once it exists: a new recording needs new channel ids. */
    private static final String CHANNEL = "adhan-1";
    private static final String CHANNEL_FAJR = "adhan-fajr-1";

    private static final String PREFS = "naba-adhan";
    private static final String KEY_TIMES = "times";
    private static final String KEY_LABELS = "labels";
    private static final int NOTIFICATION_ID = 7301;
    private static final int ALARM_REQUEST = 7302;
    private static final int OPEN_REQUEST = 7303;
    private static final int STOP_REQUEST = 7304;
    /** A phone that was off at prayer time stays quiet when it comes back: an adhan long after the time misleads. */
    private static final long LATE_MS = 10 * 60_000L;
    /** How long the notification stays up. Removing it ends the sound, so never shorter than the recording. */
    private static final long SHOWN_MS = 45 * 60_000L;

    private Adhan() {}

    /** Keeps the coming prayer times, and the words to show in the app's language, then sets the next one. */
    static void save(Context context, JSONArray times, JSONObject labels) {
        prefs(context).edit().putString(KEY_TIMES, times.toString()).putString(KEY_LABELS, labels.toString()).apply();
        makeChannels(context);
        scheduleNext(context);
    }

    /** The adhan is turned off: nothing more is set, and one that is sounding stops. */
    static void clear(Context context) {
        prefs(context).edit().remove(KEY_TIMES).apply();
        alarms(context).cancel(alarmIntent(context, 0));
        stop(context);
    }

    static void stop(Context context) {
        NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID);
    }

    /** Asks Android to wake the app at the next prayer time: on the minute where it is allowed to. */
    static void scheduleNext(Context context) {
        long now = System.currentTimeMillis();
        long next = 0;
        JSONArray times = times(context);
        for (int i = 0; i < times.length(); i++) {
            JSONObject time = times.optJSONObject(i);
            long at = time == null ? 0 : time.optLong("at");
            if (at > now && (next == 0 || at < next)) next = at;
        }
        AlarmManager alarms = alarms(context);
        if (next == 0) {
            alarms.cancel(alarmIntent(context, 0));
            return;
        }
        PendingIntent intent = alarmIntent(context, next);
        if (exactAllowed(context)) {
            try {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, intent);
                return;
            } catch (SecurityException e) {
                // Taken back in the meantime: the inexact way below.
            }
        }
        // Without "Alarms & reminders" Android may run some minutes late, and later still overnight.
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, intent);
    }

    /** Android 12+ asks the person before an app may set alarms to the minute; older phones always allow it. */
    static boolean exactAllowed(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms(context).canScheduleExactAlarms();
    }

    /** Whether the adhan's notifications can show: the app's notifications on, and neither adhan channel turned off. */
    static boolean notificationsAllowed(Context context) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        for (String id : new String[] { CHANNEL, CHANNEL_FAJR }) {
            NotificationChannel channel = manager.getNotificationChannel(id);
            if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    /** The alarm went off: the adhan for the prayer it was set for, then the next alarm. */
    static void sound(Context context, long at) {
        JSONObject prayer = null;
        JSONArray times = times(context);
        for (int i = 0; i < times.length(); i++) {
            JSONObject time = times.optJSONObject(i);
            if (time != null && time.optLong("at") == at) prayer = time;
        }
        long late = System.currentTimeMillis() - at;
        if (prayer != null && late > -60_000L && late < LATE_MS) show(context, prayer);
        scheduleNext(context);
    }

    private static void show(Context context, JSONObject prayer) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return;
        }
        makeChannels(context);
        boolean fajr = "fajr".equals(prayer.optString("prayer"));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, fajr ? CHANNEL_FAJR : CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_naba)
            .setColor(ContextCompat.getColor(context, R.color.naba_gold))
            .setContentTitle(prayer.optString("title"))
            .setContentText(prayer.optString("body"))
            .setWhen(prayer.optLong("at"))
            .setShowWhen(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setTimeoutAfter(SHOWN_MS)
            .setContentIntent(openPrayer(context))
            .addAction(0, labels(context).optString("stop", "Stop"), stopIntent(context));
        // Android 7 has no channels: the sound goes on the notification itself.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) builder.setSound(soundUri(context, fajr), AudioManager.STREAM_NOTIFICATION);
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
        NabaAdhanPlugin.sounded(prayer.optString("prayer"));
    }

    /** The two sounds, as channels people can see and change in Android's settings for the app. */
    private static void makeChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        JSONObject labels = labels(context);
        AudioAttributes audio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        NotificationChannel full = new NotificationChannel(CHANNEL, labels.optString("channel", "Adhan"), NotificationManager.IMPORTANCE_HIGH);
        full.setSound(soundUri(context, false), audio);
        NotificationChannel fajr = new NotificationChannel(CHANNEL_FAJR, labels.optString("fajrChannel", "Fajr adhan"), NotificationManager.IMPORTANCE_HIGH);
        fajr.setSound(soundUri(context, true), audio);
        // Made once; afterwards this only renames them, to the app's language.
        manager.createNotificationChannel(full);
        manager.createNotificationChannel(fajr);
    }

    /** res/raw/adhan.mp3 and adhan_fajr.mp3, by name: a channel keeps this address across app updates. */
    private static Uri soundUri(Context context, boolean fajr) {
        return new Uri.Builder()
            .scheme(ContentResolver.SCHEME_ANDROID_RESOURCE)
            .authority(context.getPackageName())
            .appendPath("raw")
            .appendPath(fajr ? "adhan_fajr" : "adhan")
            .build();
    }

    private static PendingIntent alarmIntent(Context context, long at) {
        Intent intent = new Intent(context, AdhanReceiver.class).setAction(ACTION_SOUND).putExtra(EXTRA_AT, at);
        return PendingIntent.getBroadcast(context, ALARM_REQUEST, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Tapping the notification opens the Prayer screen (MainActivity.openLink). */
    private static PendingIntent openPrayer(Context context) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://qurannaba.com/prayer"), context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, OPEN_REQUEST, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent stopIntent(Context context) {
        Intent intent = new Intent(context, AdhanReceiver.class).setAction(ACTION_STOP);
        return PendingIntent.getBroadcast(context, STOP_REQUEST, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static JSONArray times(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_TIMES, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static JSONObject labels(Context context) {
        try {
            return new JSONObject(prefs(context).getString(KEY_LABELS, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static AlarmManager alarms(Context context) {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }
}
