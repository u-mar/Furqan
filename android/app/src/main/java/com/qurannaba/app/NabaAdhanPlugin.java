package com.qurannaba.app;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;

/**
 * The adhan with the app closed (Adhan), for the site (lib/native-adhan.ts): it hands over the
 * coming prayer times, asks what Android allows, and opens Android's settings where that falls
 * short. While the app is open the site is told when the adhan sounds, to pause a recitation.
 */
@CapacitorPlugin(name = "NabaAdhan")
public class NabaAdhanPlugin extends Plugin {

    private static WeakReference<NabaAdhanPlugin> live = new WeakReference<>(null);

    @Override
    public void load() {
        live = new WeakReference<>(this);
    }

    /** { times: [{ at, prayer, title, body }], labels: { channel, fajrChannel, stop } } */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSArray times = call.getArray("times");
        if (times == null) {
            call.reject("No prayer times");
            return;
        }
        Adhan.save(getContext(), times, call.getObject("labels", new JSObject()));
        call.resolve(status());
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Adhan.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    /** { page: "alarms" | "notifications" }: Android's own page for the app, to turn that on. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Context context = getContext();
        Uri app = Uri.parse("package:" + context.getPackageName());
        Intent intent;
        if ("alarms".equals(call.getString("page")) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, app);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, app);
        }
        try {
            getActivity().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            // Some phones leave the narrower pages out: the app's page has them all.
            getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, app));
        }
        call.resolve();
    }

    private JSObject status() {
        JSObject result = new JSObject();
        result.put("exact", Adhan.exactAllowed(getContext()));
        result.put("notifications", Adhan.notificationsAllowed(getContext()));
        return result;
    }

    /** The adhan has begun: an open app pauses whatever it is reciting. */
    static void sounded(String prayer) {
        NabaAdhanPlugin plugin = live.get();
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("prayer", prayer);
        plugin.notifyListeners("adhan", data);
    }
}
