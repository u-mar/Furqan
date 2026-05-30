import type { Metadata, Viewport } from 'next'
import { Amiri, Cormorant_Garamond } from 'next/font/google'
import AppShell from '@/components/AppShell'
import AdminRuntime from '@/components/admin/AdminRuntime'
import AppSplash from '@/components/AppSplash'
import InstallPrompt from '@/components/InstallPrompt'
import WelcomeAccountDialog from '@/components/onboarding/WelcomeAccountDialog'
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

const homeSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-home-serif',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: APP_ICON_THEME_COLOR,
}

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Read the Quran and practice your hifdh with Al Furqaan',
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
      className={`dark ${amiri.variable} ${homeSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('al_quran_settings')||'{}');var dark=s.theme!=='light';document.documentElement.classList.toggle('dark',dark);document.documentElement.style.colorScheme=dark?'dark':'light';}catch(e){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}})();`,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)] antialiased">
        <SettingsProvider>
          <AppSplash />
          <AppShell>{children}</AppShell>
          <AdminRuntime />
          <PwaRegister />
          <OfflineBootstrap />
          <InstallPrompt />
          <WelcomeAccountDialog />
        </SettingsProvider>
      </body>
    </html>
  )
}
