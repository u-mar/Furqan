package com.qurannaba.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps a recitation (Listen) or the nature sounds playing with the phone locked or another app
 * open. Android slows down, and after some minutes may cut off, an app that plays in the
 * background without a foreground service, which a listener hears as clicks and then silence;
 * this is the "Now playing" service music apps run. While something plays it holds the CPU (and
 * on older phones Wi-Fi) awake for the stream.
 *
 * The audio itself stays in the page (lib/listen-player.ts, lib/nature-sounds.ts); the page says
 * what is playing through NabaPlaybackPlugin, and the notification's Pause/Play and Stop go back
 * to the page the same way. It runs from the first play until the listening stops.
 */
public class NabaPlaybackService extends Service {

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_TEXT = "text";
    static final String EXTRA_PLAYING = "playing";
    static final String EXTRA_PAUSE = "pauseLabel";
    static final String EXTRA_PLAY = "playLabel";
    static final String EXTRA_STOP = "stopLabel";
    static final String EXTRA_CHANNEL = "channelName";

    private static final String ACTION_TOGGLE = "com.qurannaba.app.playback.TOGGLE";
    private static final String ACTION_STOP = "com.qurannaba.app.playback.STOP";
    private static final String CHANNEL = "playback-1";
    private static final int NOTIFICATION_ID = 7301;

    /** The running service, so the plugin can update it without starting it again from the background. */
    @Nullable static NabaPlaybackService running;

    private Intent last;
    private boolean foreground;
    private PowerManager.WakeLock cpu;
    private WifiManager.WifiLock wifi;

    @Override
    public void onCreate() {
        super.onCreate();
        running = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_TOGGLE.equals(action)) {
            NabaPlaybackPlugin.emit("toggle");
            return START_NOT_STICKY;
        }
        if (ACTION_STOP.equals(action)) {
            NabaPlaybackPlugin.emit("stop");
            finish();
            return START_NOT_STICKY;
        }
        show(intent != null ? intent : last);
        return START_NOT_STICKY;
    }

    /** What is playing now: the notification follows, and the locks are held only while it plays. */
    void show(@Nullable Intent state) {
        if (state == null) return;
        last = state;
        Notification notification = build(state);
        if (!foreground) {
            // Once, as it starts (the person has just pressed play, with the app open).
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0
            );
            foreground = true;
        } else {
            // After that only the notification changes, which is allowed with the app in the background too.
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.notify(NOTIFICATION_ID, notification);
        }
        holdAwake(state.getBooleanExtra(EXTRA_PLAYING, false));
    }

    void finish() {
        holdAwake(false);
        foreground = false;
        // Something played again straight after stopping starts a new service, not this ending one.
        if (running == this) running = null;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private Notification build(Intent state) {
        ensureChannel(state.getStringExtra(EXTRA_CHANNEL));
        boolean playing = state.getBooleanExtra(EXTRA_PLAYING, false);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_naba)
            .setColor(ContextCompat.getColor(this, R.color.naba_gold))
            .setContentTitle(state.getStringExtra(EXTRA_TITLE))
            .setContentText(state.getStringExtra(EXTRA_TEXT))
            .setContentIntent(openApp())
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            // Swiped away only once it is paused; while playing it stays, as a music app's does.
            .setOngoing(playing)
            .addAction(
                playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                label(state, playing ? EXTRA_PAUSE : EXTRA_PLAY, playing ? "Pause" : "Play"),
                command(ACTION_TOGGLE, 1)
            )
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, label(state, EXTRA_STOP, "Stop"), command(ACTION_STOP, 2))
            .setDeleteIntent(command(ACTION_STOP, 3));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);
        }
        return builder.build();
    }

    private static String label(Intent state, String key, String fallback) {
        String value = state.getStringExtra(key);
        return value != null && !value.isEmpty() ? value : fallback;
    }

    private PendingIntent command(String action, int request) {
        Intent intent = new Intent(this, NabaPlaybackService.class).setAction(action);
        return PendingIntent.getService(this, request, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Back to the app, as it was. */
    private PendingIntent openApp() {
        Intent intent = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void ensureChannel(@Nullable String name) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel existing = manager.getNotificationChannel(CHANNEL);
        String shown = name != null && !name.isEmpty() ? name : "Now playing";
        if (existing != null && shown.contentEquals(existing.getName())) return;
        // Quiet: it only shows what is playing and lets it be paused.
        NotificationChannel channel = new NotificationChannel(CHANNEL, shown, NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    @SuppressWarnings("deprecation")
    private void holdAwake(boolean playing) {
        if (playing) {
            if (cpu == null) {
                PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (power != null) {
                    cpu = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "naba:playback");
                    cpu.setReferenceCounted(false);
                }
            }
            if (cpu != null && !cpu.isHeld()) cpu.acquire();
            // Older phones may let Wi-Fi doze with the screen off; from Android 14 this lock is ignored, so it is not asked for.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                if (wifi == null) {
                    WifiManager manager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                    if (manager != null) {
                        wifi = manager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "naba:playback");
                        wifi.setReferenceCounted(false);
                    }
                }
                if (wifi != null && !wifi.isHeld()) wifi.acquire();
            }
            return;
        }
        if (cpu != null && cpu.isHeld()) cpu.release();
        if (wifi != null && wifi.isHeld()) wifi.release();
    }

    /** The app swiped away from recent apps: the page, and its audio, are gone too. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        finish();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        holdAwake(false);
        if (running == this) running = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
