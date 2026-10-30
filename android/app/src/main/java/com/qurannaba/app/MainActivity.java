package com.qurannaba.app;

import android.Manifest;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int FIRST_OPEN_REQUEST = 7201;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins, registered before the bridge starts.
        registerPlugin(NabaBarsPlugin.class);
        registerPlugin(NabaGooglePlugin.class);
        registerPlugin(NabaSpeechPlugin.class);
        registerPlugin(NabaSharePlugin.class);
        registerPlugin(NabaAppPlugin.class);
        super.onCreate(savedInstanceState);
        serveBundledQuran();
        askOnFirstOpen();
    }

    /**
     * Requests for the mushaf (the Quran text and the page fonts) are answered from the app's own
     * files (BundledQuran), both from the page and from the site's service worker; everything else
     * goes on to Capacitor as before.
     */
    private void serveBundledQuran() {
        Bridge bridge = getBridge();
        if (bridge == null) return;
        BundledQuran quran = new BundledQuran(getAssets());
        bridge.setWebViewClient(
            new BridgeWebViewClient(bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    WebResourceResponse own = quran.serve(request);
                    return own != null ? own : super.shouldInterceptRequest(view, request);
                }
            }
        );
        ServiceWorkerController.getInstance().setServiceWorkerClient(
            new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    WebResourceResponse own = quran.serve(request);
                    return own != null ? own : bridge.getLocalServer().shouldInterceptRequest(request);
                }
            }
        );
    }

    /**
     * The first time the app opens, Android's own questions, the way other apps ask: location
     * (prayer times and the qibla follow where the phone is), then notifications (Android 13 and
     * newer ask for them; older phones allow them anyway). Each is asked once; after a "no", the
     * Prayer screen offers to ask for location again from a tap, and turning a notification on asks
     * again too.
     */
    private void askOnFirstOpen() {
        SharedPreferences prefs = getSharedPreferences("naba", MODE_PRIVATE);
        List<String> ask = new ArrayList<>();
        if (!prefs.getBoolean("asked_location", false) && !hasLocation()) {
            ask.add(Manifest.permission.ACCESS_FINE_LOCATION);
            ask.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !prefs.getBoolean("asked_notifications", false) &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ask.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        prefs.edit().putBoolean("asked_location", true).putBoolean("asked_notifications", true).apply();
        // One request: Android shows its questions one after the other.
        if (!ask.isEmpty()) ActivityCompat.requestPermissions(this, ask.toArray(new String[0]), FIRST_OPEN_REQUEST);
    }

    /** Approximate is enough: prayer times do not need the exact spot. */
    private boolean hasLocation() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // The page may have asked for the position while the question was up, and been told no:
        // once allowed, it is told to find the phone now (hooks/usePrayer.ts).
        if (requestCode == FIRST_OPEN_REQUEST && hasLocation() && getBridge() != null) {
            getBridge().triggerWindowJSEvent("nabalocationallowed");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openLink(intent);
    }

    /**
     * A qurannaba.com link that opened the app (see the intent filter in AndroidManifest.xml) opens
     * on its own page. Capacitor itself always starts on the home page; this runs on a cold start
     * too, since BridgeActivity hands the launching intent to onNewIntent, and goes after the home
     * page's load, so it wins.
     */
    private void openLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || getBridge() == null) return;
        Uri link = intent.getData();
        if (link == null || !"https".equals(link.getScheme()) || !"qurannaba.com".equals(link.getHost())) return;
        WebView webView = getBridge().getWebView();
        webView.post(() -> webView.loadUrl(link.toString()));
    }
}
