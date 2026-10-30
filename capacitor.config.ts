import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Play Store app (Capacitor, Android). It opens the live site, so every
 * update to the website reaches the app at once, with no new release; the
 * service worker keeps the screens and the saved mushaf on the phone, so it
 * opens fast and works offline after the first launch. The Android project is
 * in android/; after changing this file, run `npx cap sync android`.
 *
 * appId is the Play Store package name: it can never change once published.
 */
const config: CapacitorConfig = {
  appId: 'com.qurannaba.app',
  appName: 'Naba',
  // Only the screen shown when the site can't be reached on the very first launch.
  webDir: 'native/www',
  backgroundColor: '#000000',
  // Lets the site tell the app from a browser (see components/OfflineBootstrap.tsx), and that this
  // app carries the mushaf inside it (NabaQuran: android/…/BundledQuran.java, lib/native-app.ts).
  appendUserAgent: 'NabaAndroid NabaQuran/1',
  server: {
    url: 'https://qurannaba.com',
    errorPath: 'offline.html',
  },
  plugins: {
    // The page sits between the status bar and the navigation bar (it has no
    // viewport-fit=cover); components/NativeBars.tsx paints them to match it.
    SystemBars: { insetsHandling: 'native' },
    // Reading reminders, scheduled on the phone: the Naba mark in the status bar, in gold.
    LocalNotifications: { smallIcon: 'ic_stat_naba', iconColor: '#E0BC74' },
    // Notifications from Firebase that arrive while the app is open still show.
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
}

export default config
