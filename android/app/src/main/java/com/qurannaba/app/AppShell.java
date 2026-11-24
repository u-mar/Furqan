package com.qurannaba.app;

import android.content.Context;
import android.content.res.AssetManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Naba's main screens carried inside the app (scripts/snapshot-app-shell.mjs puts them in its assets
 * at build time): when the phone has no working connection, a screen and its scripts, styles and
 * fonts are answered from here, so the app opens offline even on its very first launch, before the
 * site was ever saved on the phone. With a connection nothing here is used, and the live site (and
 * its own offline copy, kept by its service worker) is as before.
 */
final class AppShell {

    private static final String ROOT = "appshell/";
    private static final Map<String, String> SCREENS = new HashMap<>();

    static {
        SCREENS.put("/", "pages/index.html");
        SCREENS.put("/read", "pages/read.html");
        SCREENS.put("/listen", "pages/listen.html");
        SCREENS.put("/prayer", "pages/prayer.html");
        SCREENS.put("/prayer/qibla", "pages/prayer-qibla.html");
        SCREENS.put("/settings", "pages/settings.html");
        SCREENS.put("/qari", "pages/qari.html");
        SCREENS.put("/halaqa", "pages/halaqa.html");
    }

    private final Context context;
    private final AssetManager assets;

    AppShell(Context context) {
        this.context = context.getApplicationContext();
        this.assets = context.getAssets();
    }

    /** The app's own copy of what `request` asks for, when offline; null otherwise (or if not carried). */
    WebResourceResponse serve(WebResourceRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
        Uri url = request.getUrl();
        if (!"qurannaba.com".equals(url.getHost()) || url.getPath() == null) return null;
        if (isOnline()) return null;
        String path = url.getPath();
        if (path.length() > 1 && path.endsWith("/")) path = path.substring(0, path.length() - 1);

        String screen = SCREENS.get(path);
        if (screen != null) return open(screen, "text/html", "utf-8");
        if (path.startsWith("/_next/static/") || "/quran-chapters.json".equals(path)) {
            return open(path.substring(1), mimeFor(path), null);
        }
        return null;
    }

    /** Whether the phone has a connection that actually reaches the internet. */
    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            Network network = cm.getActiveNetwork();
            if (network == null) return false;
            NetworkCapabilities caps = cm.getNetworkCapabilities(network);
            return caps != null
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
        } catch (Exception e) {
            // Unsure: leave it to the network, as before.
            return true;
        }
    }

    private WebResourceResponse open(String asset, String mimeType, String encoding) {
        try {
            InputStream stream = assets.open(ROOT + asset);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, stream);
        } catch (IOException e) {
            // Not carried in this build.
            return null;
        }
    }

    private static String mimeFor(String path) {
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".woff")) return "font/woff";
        if (path.endsWith(".ttf")) return "font/ttf";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }
}
