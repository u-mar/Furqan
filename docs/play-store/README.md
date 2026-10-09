# Publishing Naba on Google Play

Naba is a web app (PWA). It goes on Google Play as a **Trusted Web Activity
(TWA)**: a small Android app, built with Google's Bubblewrap tool, that opens
the live site full screen with no browser bar. Updates to the website reach
the Play app straight away; a new Play build is only needed to change the
icon, name, package or Android settings.

Also in this folder:

- `listing.md`: store listing text (name, descriptions, category)
- `data-safety.md`: answers for the Data safety form
- `assets/icon-512.png`: the 512×512 store icon
- `assets/feature-graphic-1024x500.png`: the feature graphic

## Before you start

1. **Set a real support email.** `SUPPORT_EMAIL` in `lib/app-brand.ts` is
   still `support@example.com`. It appears on the privacy policy, terms and
   account deletion page, and Play shows it to users. Use an address you check.
2. **Deploy the site on HTTPS** at the domain the app will use (for example on
   Vercel). Run `npx prisma generate` as part of the build.
3. **Check these pages load on the live site:**
   - `https://YOUR-DOMAIN/manifest.webmanifest`
   - `https://YOUR-DOMAIN/privacy`, `/terms`, `/delete-account`
   - `https://YOUR-DOMAIN/.well-known/assetlinks.json` (shows `[]` until step 4 of the build)
4. **Have a Google Play developer account** (one-time US$25 fee).

## Build the Android app

You need Node.js and a Java JDK. Bubblewrap can download the JDK and Android SDK for you.

```bash
npm install -g @bubblewrap/cli
```

```bash
mkdir naba-android && cd naba-android
```

```bash
bubblewrap init --manifest https://YOUR-DOMAIN/manifest.webmanifest
```

Answers to give `init` (it reads most of them from the manifest):

| Question | Answer |
|---|---|
| Domain | `YOUR-DOMAIN` (no https://) |
| URL path | `/` |
| Application name | `Naba` |
| Short name | `Naba` |
| Application ID (package) | e.g. `app.nabaquran`. **This can never change once published.** |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Status bar / theme colour | `#000000` |
| Splash background colour | `#000000` |
| Icon URL | `https://YOUR-DOMAIN/icons/icon-512` |
| Maskable icon URL | `https://YOUR-DOMAIN/icons/icon-maskable-512` |
| Include support for Play Billing | No |
| Request geolocation permission | **Yes** (prayer times and qibla use location) |
| Signing key | Create a new one. **Back up the `.keystore` file and its passwords.** You can't update the app without them. |

Then open the generated `twa-manifest.json` and check that:

- `"enableNotifications": true` is set, so likes, follows and adhan
  notifications work on Android 13 and later.
- `"features": { "locationDelegation": { "enabled": true } }` is set.

If you changed anything, run `bubblewrap update`. Then build:

```bash
bubblewrap build
```

This makes `app-release-bundle.aab` (to upload to Play) and
`app-release-signed.apk` (to try on your own phone with
`bubblewrap install`).

## Connect the app to the site (removes the browser bar)

1. In Play Console, create the app and upload the `.aab` to **Internal testing**.
   Keep **Play App Signing** on (the default).
2. Go to **Test and release → App integrity → App signing** and copy the
   **SHA-256 certificate fingerprint** of the *app signing key*. Also copy
   the *upload key* fingerprint, so builds installed directly from
   Bubblewrap work too.
3. In your hosting settings, set:
   - `ANDROID_PACKAGE_NAME` = the package from `init` (e.g. `app.nabaquran`)
   - `ANDROID_SHA256_FINGERPRINTS` = both fingerprints, separated by a comma
4. Redeploy, then open `https://YOUR-DOMAIN/.well-known/assetlinks.json`. It
   should list the package and fingerprints.
5. Install the internal test build. If the address bar still shows at the top,
   the fingerprints or package don't match.

## Fill in Play Console

- **Store listing:** text from `listing.md`, the icon and feature graphic
  from `assets/`, and at least 2 phone screenshots (take them on a phone; see
  `listing.md` for which screens).
- **Privacy policy URL:** `https://YOUR-DOMAIN/privacy`
- **App access:** most of the app works without signing in. Posting in Qari
  needs an account: give reviewers a test username and PIN.
- **Ads:** No ads.
- **Content rating:** fill in the questionnaire. Answer *yes* to "users can
  interact or share content", since Qari has posts, likes and follows.
- **Target audience:** choose **13 and over**. Choosing under 13 puts the app
  under the Families policy, which public posting and accounts don't meet.
- **Data safety:** answers in `data-safety.md`.
- **Account deletion:** "Yes, users can delete their account." Web link:
  `https://YOUR-DOMAIN/delete-account`
- **Government apps / financial features / health:** No.

## Testing before production

New personal developer accounts must run a **closed test with at least 12
testers for 14 days in a row** before they can publish to production. Start
this early: add testers by email in **Closed testing**, have them install
from the Play link, and keep it running.

## Already handled in the app

- Manifest with a fixed `id`, a 512 icon, a separate maskable (adaptive)
  icon, and long-press shortcuts (Read, Listen, Qari, Prayer times)
- An offline page, so a screen never opened before shows a proper message
  offline instead of an error
- `/.well-known/assetlinks.json`, driven by the two settings above
- `/delete-account`, the account-deletion page Play asks for
- Privacy policy and terms, written from what the app actually stores
- In-app reporting of posts, blocking users (from any post's menu or their profile, with a list to unblock in Settings), and account deletion in Settings

## Worth doing before launch

- **Screenshots in both themes.** If you can, include a dark-mode shot.
- **Licences.** The Hifdh Test is off and its speech model is removed. The
  background photos (Unsplash) and video clips (Coverr) don't require credit,
  and the privacy policy names the Quran sources.
