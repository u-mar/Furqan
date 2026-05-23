import type { Metadata, Viewport } from 'next'
import { Amiri } from 'next/font/google'
import AppShell from '@/components/AppShell'
import InstallPrompt from '@/components/InstallPrompt'
import PwaRegister from '@/components/PwaRegister'
import './globals.css'

const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
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
    <html lang="en" className={`dark ${amiri.variable}`}>
      <body className="min-h-[100dvh] bg-[#0a0a0a] text-white antialiased">
        <AppShell>{children}</AppShell>
        <PwaRegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
