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
  daily. On wherever the phone allows Naba's notifications (asked when the app
  first opens); nothing asks about them on Home. Turned off in Settings.

## The adhan with the app closed

In the app, the Prayer screen's adhan sounds even when Naba is closed:

- `lib/native-adhan.ts` works out the next 60 days of adhan times on the phone,
  in the app's language. It hands them to `NabaAdhanPlugin.java` every time the
  app opens and whenever the place, method or bells change.
- `Adhan.java` keeps them and asks Android to wake the app at the next one.
  `AdhanReceiver` then posts a notification, and that notification's sound is
  the adhan:
  - every prayer except Fajr: `res/raw/adhan.mp3` (Mansour al-Zahrani, 2:11)
  - Fajr: `adhan_fajr.mp3`, only the opening takbir, because this recording is
    not the Fajr adhan
- Tapping the notification opens the Prayer screen. Tapping it, swiping it away
  or pressing Stop ends the sound.
- It follows the phone's notification volume, silent mode and Do Not Disturb.
- The website plays the same opening takbir (`public/audio/adhan.mp3`), only
  while it is open.

On Android 14 and newer, the adhan only sounds on the minute once the person
allows "Alarms & reminders" (`SCHEDULE_EXACT_ALARM`); the Prayer screen offers
this with an **Allow** link. Without it, Android may run late, and an adhan more
than 10 minutes late is skipped. Google Play has no declaration form for
`SCHEDULE_EXACT_ALARM` (the form is for `USE_EXACT_ALARM`, which the app doesn't
use).

To change a recording, replace the file and raise the channel ids in
`Adhan.java` (`adhan-1`, `adhan-fajr-1`). Android keeps a channel's sound once
the channel exists. A real Fajr adhan goes in `adhan_fajr.mp3` the same way.

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
| Upload key (signs the AAB) | `CD:1C:7C:59:2D:55:07:0F:87:57:5B:21:C1:BA:F3:BC:DE:69:90:59` | to add |
| Play App Signing key (Play Console → App integrity) | `57:7B:5E:56:ED:81:7D:42:FE:A8:BB:1C:5E:99:48:82:A4:21:E9:AD` | `677280780992-8icumnne5k63ttf2eq8cmu6lbdr5v9qq` ("naba android play") |

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

```bash
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ./gradlew bundleRelease
```

The bundle is `android/app/build/outputs/bundle/release/app-release.aab`, signed
with the upload key in `C:\Users\hp\.naba-keys` (`naba-upload.jks`, with its
passwords in `upload-key.properties`, read by `android/app/build.gradle`). That
folder is never in git: keep a backup of it somewhere safe. Raise `versionCode`
(and `versionName`) in `android/app/build.gradle` for every upload.

Upload key fingerprints: SHA-1 `CD:1C:7C:59:2D:55:07:0F:87:57:5B:21:C1:BA:F3:BC:DE:69:90:59`,
SHA-256 `FA:B0:51:8F:C0:4E:19:FD:CE:FB:16:8A:84:1F:A1:B9:6A:D2:1E:1C:2C:F5:32:84:F6:E9:45:82:69:0F:7B:04`.
