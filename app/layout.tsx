import type { Metadata, Viewport } from 'next'
import { Amiri, Cormorant_Garamond, Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import AppShell from '@/components/AppShell'
import AdminRuntime from '@/components/admin/AdminRuntime'
import BottomNav from '@/components/nav/BottomNav'
import AdhanHost from '@/components/prayer/AdhanHost'
import ViewportLock from '@/components/ViewportLock'
import AccountPromptHost from '@/components/account/AccountPromptHost'
import ToastHost from '@/components/feedback/ToastHost'
import ListenPlaybackGuard from '@/components/ListenPlaybackGuard'
import OfflineBootstrap from '@/components/OfflineBootstrap'
import NativeBars from '@/components/NativeBars'
import { SITE_URL, openGraphFor } from '@/lib/share-preview'
import NativeNotifications from '@/components/NativeNotifications'
import NativeShare from '@/components/NativeShare'
import PwaRegister from '@/components/PwaRegister'
import SettingsProvider from '@/components/settings/SettingsProvider'
import SplashScreen from '@/components/SplashScreen'
import { APP_ICON_THEME_COLOR, APP_NAME } from '@/lib/app-brand'
import './globals.css'
import './mushaf-qcf.css'

// The fonts below are kept to what is used and only the two that set nearly
// every screen's text are preloaded: on a slow connection, preloading all of
// them (about 360 KB) held up the app's own code on every screen.

/** Arabic labels (greeting, surah names). Regular only; not preloaded, it swaps in. */
const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400'],
  variable: '--font-amiri',
  display: 'swap',
  preload: false,
})

const homeSerif = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  variable: '--font-home-serif',
  display: 'swap',
})

/** The translation over a Qari video: a light italic serif, as Quran edits set it. */
const edit = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['500'],
  style: ['italic'],
  variable: '--font-edit',
  display: 'swap',
  preload: false,
})

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The app is laid out for the phone's own width; zooming it only ever breaks the layout.
  maximumScale: 1,
  userScalable: false,
  themeColor: APP_ICON_THEME_COLOR,
}

export const metadata: Metadata = {
  // Link previews need absolute addresses; every page's picture and link are made from this.
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: `Read the Quran, listen, and read together in a halaqa with ${APP_NAME}`,
  ...openGraphFor({
    title: APP_NAME,
    description: `Read the Quran, listen, and read together in a halaqa with ${APP_NAME}`,
  }),
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon', type: 'image/png' }],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${amiri.variable} ${homeSerif.variable} ${edit.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('al_quran_settings')||'{}');var t=(s.theme==='dark'||s.theme==='black')?s.theme:'light';var d=document.documentElement;d.classList.remove('dark','black');if(s.language==='so'||s.language==='ar'){d.lang=s.language;if(s.language==='ar')d.dir='rtl';}if(t==='light'){d.style.colorScheme='light';}else{d.classList.add('dark');if(t==='black'){d.classList.add('black');}d.style.colorScheme='dark';}}catch(e){document.documentElement.style.colorScheme='light';}try{if(sessionStorage.getItem('nadir-splash-shown')==='1')document.documentElement.classList.add('splash-seen');}catch(e){}try{var n=navigator,m=n.deviceMemory,c=n.hardwareConcurrency,sd=n.connection&&n.connection.saveData;if((m&&m<=2)||(m&&m<=4&&c&&c<=4)||sd)document.documentElement.classList.add('lite');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)] antialiased">
        <SettingsProvider>
          <AppShell>{children}</AppShell>
          <AdminRuntime />
          <ListenPlaybackGuard />
          <PwaRegister />
          <ViewportLock />
          <AdhanHost />
          <OfflineBootstrap />
          <NativeBars />
          <NativeShare />
          <NativeNotifications />
          <AccountPromptHost />
          <ToastHost />
          <BottomNav />
          <SplashScreen />
        </SettingsProvider>
      </body>
    </html>
  )
}
