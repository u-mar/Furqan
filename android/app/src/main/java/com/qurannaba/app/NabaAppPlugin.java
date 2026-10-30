package com.qurannaba.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What this copy of the app can do, for the site to ask before it tries. Push notifications go
 * through Firebase, which only works in a build made with the project's google-services.json
 * (android/app/): without it, asking Firebase for this phone's address crashes the app, so the
 * site checks here first (lib/push-client.ts).
 */
@CapacitorPlugin(name = "NabaApp")
public class NabaAppPlugin extends Plugin {

    @PluginMethod
    public void info(PluginCall call) {
        // The Google Services build step writes this string only when it finds the Firebase file.
        boolean pushReady = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName()) != 0;
        JSObject result = new JSObject();
        result.put("pushReady", pushReady);
        call.resolve(result);
    }
}
