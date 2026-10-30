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
  the user agent).
- **The mushaf is inside the app** (about 100 MB of the ~103 MB APK): the Quran
  text, the 604 page fonts, and the English (Saheeh International) and Somali
  (Abduh) translations. `BundledQuran.java` answers `/quran-data.json`,
  `/qcf/p{n}.woff2` and `/bundled/translations/<id>.json` from the app's own
  files, online or offline; `NabaQuran` in the user agent tells the site
  (`hasBundledQuran()` in `lib/native-app.ts`), which then downloads nothing.
  After the first open with internet (the app's screens, a few MB), Read works
  fully offline. The build copies the files in (`copyBundledQuran` in
  `android/app/build.gradle`) to `~/.naba-build/quran-assets`, outside OneDrive,
  whose cloud placeholders Gradle cannot read. The translation files are made by
  `node native/make-translations.mjs` (dev server running).

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

## Links open in the app

qurannaba.com links tapped anywhere (a shared recitation, a halaqa invite, a
password reset email) open in the app on that page: the intent filter in
`AndroidManifest.xml` names the paths, and `MainActivity.openLink` loads the
page. Android only trusts this when the site lists the key the app is signed
with, at `/.well-known/assetlinks.json` (`app/.well-known/assetlinks.json/route.ts`).
Add the SHA-256 of the upload key and of Google's app signing key there before
the first release (Play Console → Test and release → App integrity).

## Notifications

- **Qari and halaqa notifications** reach the app through Firebase Cloud
  Messaging (its WebView has no web push). The same buttons as on the website
  register the phone's Firebase token (`lib/push-client.ts`); the server sends
  to it with `lib/fcm.ts`. Setup, once:
  1. Firebase console → add a project (or use the Google Cloud one) → add an
     Android app with package `com.qurannaba.app` → download
     `google-services.json` into `android/app/`, then build again.
  2. Project settings → Service accounts → Generate new private key; paste the
     whole JSON into Vercel as `FIREBASE_SERVICE_ACCOUNT`.
  Until both are done, push simply stays off in the app (`NabaAppPlugin`
  tells the site whether this build has Firebase; asking without it crashes).
- **Reading reminders** are scheduled on the phone (`lib/reading-reminders.ts`):
  3 and 7 days after the last time someone read, at their usual hour, never
  daily. Turned on from Home (asked once) or Settings.

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
