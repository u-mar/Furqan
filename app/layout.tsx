import type { Metadata, Viewport } from 'next'
import { Amiri, Fraunces, Plus_Jakarta_Sans } from 'next/font/google'
import AppShell from '@/components/AppShell'
import AdminRuntime from '@/components/admin/AdminRuntime'
import BottomNav from '@/components/nav/BottomNav'
import AdhanHost from '@/components/prayer/AdhanHost'
import ViewportLock from '@/components/ViewportLock'
import AccountPromptHost from '@/components/account/AccountPromptHost'
import ToastHost from '@/components/feedback/ToastHost'
import ListenPlaybackGuard from '@/components/ListenPlaybackGuard'
import OfflineBootstrap from '@/components/OfflineBootstrap'
import PwaRegister from '@/components/PwaRegister'
import SettingsProvider from '@/components/settings/SettingsProvider'
import { APP_ICON_THEME_COLOR, APP_NAME } from '@/lib/app-brand'
import './globals.css'
import './mushaf-qcf.css'

const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
})

const homeSerif = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-home-serif',
  display: 'swap',
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
  title: APP_NAME,
  description: 'Read the Quran, listen, and read together in a halaqa with Al Furqaan',
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
      className={`${amiri.variable} ${homeSerif.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('al_quran_settings')||'{}');var t=(s.theme==='dark'||s.theme==='black')?s.theme:'light';var d=document.documentElement;d.classList.remove('dark','black');if(s.language==='so'||s.language==='ar'){d.lang=s.language;if(s.language==='ar')d.dir='rtl';}if(t==='light'){d.style.colorScheme='light';}else{d.classList.add('dark');if(t==='black'){d.classList.add('black');}d.style.colorScheme='dark';}}catch(e){document.documentElement.style.colorScheme='light';}})();`,
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
          <AccountPromptHost />
          <ToastHost />
          <BottomNav />
        </SettingsProvider>
      </body>
    </html>
  )
}
