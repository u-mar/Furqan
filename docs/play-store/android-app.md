# The Android app (Capacitor)

The Play Store app is a Capacitor shell in `android/` that opens the live site,
https://qurannaba.com (`capacitor.config.ts` → `server.url`). Every website
deploy reaches the app at once; a new app release is only needed when the native
side changes (permissions, icons, plugins, `capacitor.config.ts`).

- Package name: `com.qurannaba.app` (can never change once published).
- Icons and splash: drawn by `native/make-assets.py` into `native/assets/`, then
  `npx @capacitor/assets generate --android --assetPath native/assets --iconBackgroundColor '#000000' --iconBackgroundColorDark '#000000' --splashBackgroundColor '#000000' --splashBackgroundColorDark '#000000'`.
- No-internet screen on the very first launch: `native/www/offline.html`.
- Status and navigation bars take the colour of the page under them:
  `components/NativeBars.tsx` (site) → `NabaBarsPlugin.java` (app).
- The site knows it is inside the app (`window.Capacitor`, and `NabaAndroid` in
  the user agent): the whole mushaf is then saved on its own on Wi‑Fi
  (`components/OfflineBootstrap.tsx`).

## Voice search in the app

Android's WebView has no speech recognition, so in the app the search mic uses
the phone's own (`NabaSpeechPlugin.java`, called from
`hooks/useArabicVoiceInput.ts`): Google's on most phones, the same one as the
keyboard's mic. It keeps listening across pauses until the person taps stop, or
goes quiet for a while.

## Sharing and saving in the app

Android's WebView has no share sheet and no downloads. In the app,
`components/NativeShare.tsx` fills in `navigator.share` and catches the site's
download links, and hands the file to `NabaSharePlugin.java` (in pieces, as the
bridge only carries text). So every share and save button works unchanged: Qari
videos and audio, verse pictures, links. Saved files land in the gallery in a
"Naba" folder (Movies, Pictures or Music; anything else in Download). Android 9
and older ask for storage permission the first time.

## Google sign-in in the app

Google refuses its web sign-in inside an app, so in the app "Continue with
Google" opens the phone's own account picker (`NabaGooglePlugin.java`, called
from `components/account/GoogleButton.tsx`). It asks for a token made out to the
site's **Web** client (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`), so the server checks it
exactly like one from the website.

Google recognises the app by package name + signing key. Every key that signs
the app needs its own **Android** OAuth client in the same Google Cloud project
as the web client (APIs & Services → Credentials). These client ids go nowhere
in the code; they only have to exist.

| Key | SHA-1 | Android client |
| --- | --- | --- |
| Debug key on the build PC (test APKs) | `04:58:EB:31:58:F0:A9:C0:AB:45:AC:33:F8:1B:69:B9:F3:1A:86:5D` | `677280780992-1gjart45vjb6769putv05fhlejq3p8qn` |
| Upload key (signs the AAB) | to add at the first release | to add |
| Play App Signing key (Play Console → App integrity) | to add at the first release | to add |

Get a key's SHA-1 with `keytool -list -v -keystore <file> -alias <alias>`
(keytool is in Android Studio's `jbr/bin`).

## Build a test app (APK)

Uses the Java that comes with Android Studio. In Git Bash, from the repo root:

```bash
npx cap sync android
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew assembleDebug
```

The app is `android/app/build/outputs/apk/debug/app-debug.apk`. Install it on a
phone by copying it over and opening it (allow "Install unknown apps"), or with
the phone plugged in and USB debugging on:
`"$LOCALAPPDATA/Android/Sdk/platform-tools/adb" install -r android/app/build/outputs/apk/debug/app-debug.apk`.

Or open the `android/` folder in Android Studio and press Run.

## Release for the Play Store (AAB)

Android Studio → Build → Generate Signed App Bundle, with an upload key you make
there once and keep safe (the file and its password: losing them means asking
Google to reset it). Raise `versionCode` / `versionName` in
`android/app/build.gradle` for every upload.
