package com.qurannaba.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.view.Window;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Paints the strips behind the status bar and the navigation bar in the colour of the page
 * under them, with icons that stay readable on it, so the app looks the same from edge to edge
 * in every theme. The site calls it (components/NativeBars.tsx) whenever that colour changes.
 */
@CapacitorPlugin(name = "NabaBars")
public class NabaBarsPlugin extends Plugin {

    private Integer color = null;

    @PluginMethod
    public void set(PluginCall call) {
        String value = call.getString("color", "");
        try {
            color = Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            call.reject("Not a colour: " + value);
            return;
        }
        getActivity().runOnUiThread(this::paint);
        call.resolve();
    }

    private void paint() {
        if (color == null) return;
        Window window = getActivity().getWindow();
        window.getDecorView().setBackgroundColor(color);
        boolean light = ColorUtils.calculateLuminance(color) > 0.5;
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // Capacitor's own system bars plugin repaints them in the theme's colours when the phone
        // turns or switches dark mode; paint the page's colour back over it once it has.
        getBridge().getWebView().post(this::paint);
    }
}
