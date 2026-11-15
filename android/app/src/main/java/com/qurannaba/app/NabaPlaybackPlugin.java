package com.qurannaba.app;

import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The page's side of NabaPlaybackService (lib/native-playback.ts): `show` with what is playing
 * starts the service, or updates it; `hide` ends it. Its notification's buttons come back as an
 * "action" event ("toggle" or "stop").
 */
@CapacitorPlugin(name = "NabaPlayback")
public class NabaPlaybackPlugin extends Plugin {

    @Nullable private static NabaPlaybackPlugin instance;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        instance = this;
    }

    /** From the notification's buttons, to the page. */
    static void emit(String action) {
        NabaPlaybackPlugin plugin = instance;
        if (plugin == null) return;
        JSObject event = new JSObject();
        event.put("action", action);
        plugin.notifyListeners("action", event);
    }

    @PluginMethod
    public void show(PluginCall call) {
        Intent state = new Intent(getContext(), NabaPlaybackService.class)
            .putExtra(NabaPlaybackService.EXTRA_TITLE, call.getString("title", ""))
            .putExtra(NabaPlaybackService.EXTRA_TEXT, call.getString("text", ""))
            .putExtra(NabaPlaybackService.EXTRA_PLAYING, Boolean.TRUE.equals(call.getBoolean("playing", false)))
            .putExtra(NabaPlaybackService.EXTRA_PAUSE, call.getString("pauseLabel"))
            .putExtra(NabaPlaybackService.EXTRA_PLAY, call.getString("playLabel"))
            .putExtra(NabaPlaybackService.EXTRA_STOP, call.getString("stopLabel"))
            .putExtra(NabaPlaybackService.EXTRA_CHANNEL, call.getString("channelName"));
        NabaPlaybackService running = NabaPlaybackService.running;
        // Already running (perhaps with the app in the background): updated in place. Starting a
        // foreground service from the background is not allowed, and it is not needed.
        if (running != null) {
            main.post(() -> running.show(state));
            call.resolve();
            return;
        }
        try {
            ContextCompat.startForegroundService(getContext(), state);
            call.resolve();
        } catch (RuntimeException e) {
            // Android refused it (the app was already in the background): it plays on without.
            call.reject("Could not start playback in the background", e);
        }
    }

    @PluginMethod
    public void hide(PluginCall call) {
        NabaPlaybackService running = NabaPlaybackService.running;
        if (running != null) main.post(running::finish);
        call.resolve();
    }
}
