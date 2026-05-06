import type { Metadata } from 'next'
import './globals.css'

const themeScript = `
  try {
    const savedTheme = localStorage.getItem('hifdh_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch {}
`

export const metadata: Metadata = {
  title: 'Hifdh Practice',
  description: 'Test your Quran memorization with word-by-word feedback',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-[var(--hifdh-bg)] text-[var(--hifdh-text)] antialiased">{children}</body>
    </html>
  )
}
