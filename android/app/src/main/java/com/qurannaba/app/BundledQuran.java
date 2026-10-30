package com.qurannaba.app;

import android.content.res.AssetManager;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The mushaf inside the app: the Quran text (/quran-data.json), the 604 page fonts
 * (/qcf/p{n}.woff2) and the English and Somali translations (/bundled/translations/<id>.json) are
 * answered from the app's own files instead of the internet, so Read works offline with nothing to
 * download. The files are copied in when the app is built (copyBundledQuran in app/build.gradle):
 * the text and fonts from the site's public/, the translations from native/quran/translations/.
 * The site knows they are here from "NabaQuran" in the user agent (capacitor.config.ts).
 */
final class BundledQuran {

    private static final Pattern PAGE_FONT = Pattern.compile("^/qcf/p(\\d{1,3})\\.woff2$");
    private static final Pattern TRANSLATION = Pattern.compile("^/bundled/translations/(en\\.sahih|so\\.abduh)\\.json$");

    private final AssetManager assets;

    BundledQuran(AssetManager assets) {
        this.assets = assets;
    }

    /** The app's own copy of what `request` asks for, or null for anything else. */
    WebResourceResponse serve(WebResourceRequest request) {
        if (!"GET".equalsIgnoreCase(request.getMethod())) return null;
        Uri url = request.getUrl();
        if (!"qurannaba.com".equals(url.getHost()) || url.getPath() == null) return null;
        String path = url.getPath();
        if ("/quran-data.json".equals(path)) return open("quran/quran-data.json", "application/json", "utf-8");
        Matcher font = PAGE_FONT.matcher(path);
        if (font.matches()) {
            int page = Integer.parseInt(font.group(1));
            if (page >= 1 && page <= 604) return open("quran/qcf/p" + page + ".woff2", "font/woff2", null);
        }
        Matcher translation = TRANSLATION.matcher(path);
        if (translation.matches()) return open("quran/translations/" + translation.group(1) + ".json", "application/json", "utf-8");
        return null;
    }

    private WebResourceResponse open(String asset, String mimeType, String encoding) {
        try {
            Map<String, String> headers = new HashMap<>();
            // The page fonts are fetched with CORS (lib/offline-font-cache.ts).
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", "public, max-age=31536000, immutable");
            return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, assets.open(asset));
        } catch (IOException e) {
            // Not in this build: the request goes to the site as before.
            return null;
        }
    }
}
