import type { Metadata, Viewport } from 'next'
import { Amiri, Cormorant_Garamond } from 'next/font/google'
import AppShell from '@/components/AppShell'
import AdminRuntime from '@/components/admin/AdminRuntime'
import AppSplash from '@/components/AppSplash'
import InstallPrompt from '@/components/InstallPrompt'
import PwaRegister from '@/components/PwaRegister'
import SettingsProvider from '@/components/settings/SettingsProvider'
import './globals.css'

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
  themeColor: '#000000',
}

export const metadata: Metadata = {
  title: 'Al Quran',
  description: 'Read the Quran and practice your hifdh',
  applicationName: 'Al Quran',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Al Quran',
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
    <html lang="en" className={`${amiri.variable} ${homeSerif.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('al_quran_settings')||'{}');var t=s.theme==='light'?'light':'dark';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)] antialiased">
        <SettingsProvider>
          <AppSplash />
          <AppShell>{children}</AppShell>
          <AdminRuntime />
          <PwaRegister />
          <InstallPrompt />
        </SettingsProvider>
      </body>
    </html>
  )
}
