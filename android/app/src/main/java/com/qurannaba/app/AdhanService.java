package com.qurannaba.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;

/**
 * Plays the adhan itself, from the app's own recording, while its notification is up.
 *
 * It used to be the notification's own sound (the channel's sound in Adhan.java). Many phones
 * leave that out: a maker's battery or notification settings, a channel turned to silent, the
 * notification volume down. The notification then showed, Stop and all, with no adhan. Played
 * here, it is the app's own audio, at the alarm volume, and only Stop, swiping the notification
 * away or tapping it ends it.
 *
 * Like before, it stays quiet when the phone is on silent, vibrate or Do Not Disturb: the
 * notification still shows the time, without a sound.
 */
public class AdhanService extends Service {

    private static final String EXTRA_PRAYER = "prayer";

    @Nullable private MediaPlayer player;
    @Nullable private AudioFocusRequest focus;

    /** Starts it for this prayer. Throws when Android does not let the app start it from the background. */
    static void start(Context context, JSONObject prayer) {
        Intent intent = new Intent(context, AdhanService.class).putExtra(EXTRA_PRAYER, prayer.toString());
        ContextCompat.startForegroundService(context, intent);
    }

    /** Stops the sound, if it is playing. */
    static void stop(Context context) {
        context.stopService(new Intent(context, AdhanService.class));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        JSONObject prayer = null;
        try {
            if (intent != null) prayer = new JSONObject(intent.getStringExtra(EXTRA_PRAYER));
        } catch (Exception e) {
            prayer = null;
        }
        if (prayer == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        boolean fajr = "fajr".equals(prayer.optString("prayer"));
        Notification notification = Adhan.playingNotification(this, prayer);
        // Android requires the notification within moments of the start, before anything else.
        ServiceCompat.startForeground(
            this,
            Adhan.NOTIFICATION_ID,
            notification,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0
        );
        NabaAdhanPlugin.sounded(prayer.optString("prayer"));
        if (!mayRing()) {
            finish(true);
            return START_NOT_STICKY;
        }
        play(fajr);
        return START_NOT_STICKY;
    }

    /** The phone on sound, and not in Do Not Disturb: otherwise the adhan stays quiet, as a notification would. */
    private boolean mayRing() {
        AudioManager audio = getSystemService(AudioManager.class);
        if (audio != null && audio.getRingerMode() != AudioManager.RINGER_MODE_NORMAL) return false;
        NotificationManager manager = getSystemService(NotificationManager.class);
        return manager == null || manager.getCurrentInterruptionFilter() <= NotificationManager.INTERRUPTION_FILTER_ALL;
    }

    private void play(boolean fajr) {
        release();
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        try {
            MediaPlayer media = new MediaPlayer();
            player = media;
            media.setAudioAttributes(attributes);
            // The CPU stays awake for the whole recording with the screen off.
            media.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            media.setDataSource(this, Adhan.soundUri(this, fajr));
            media.setOnCompletionListener((done) -> finish(true));
            media.setOnErrorListener((failed, what, extra) -> {
                finish(true);
                return true;
            });
            media.prepare();
            takeFocus(attributes);
            media.start();
        } catch (Exception e) {
            finish(true);
        }
    }

    /** Whatever else is playing (a recitation in Listen, music) pauses for the adhan and goes on after. */
    private void takeFocus(AudioAttributes attributes) {
        AudioManager audio = getSystemService(AudioManager.class);
        if (audio == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                .setAudioAttributes(attributes)
                .setOnAudioFocusChangeListener((change) -> {})
                .build();
            audio.requestAudioFocus(focus);
        } else {
            audio.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
        }
    }

    private void release() {
        if (player != null) {
            player.release();
            player = null;
        }
        AudioManager audio = getSystemService(AudioManager.class);
        if (audio == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focus != null) audio.abandonAudioFocusRequest(focus);
            focus = null;
        } else {
            audio.abandonAudioFocus(null);
        }
    }

    /** The sound is over. The notification stays (it says which prayer), now one that can be swiped away. */
    private void finish(boolean keepNotification) {
        release();
        ServiceCompat.stopForeground(this, keepNotification ? ServiceCompat.STOP_FOREGROUND_DETACH : ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        release();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
