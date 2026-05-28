'use client'

import { useEffect, useState } from 'react'
import { APP_NAME } from '@/lib/app-brand'

const BISMILLAH = 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'
const SPLASH_KEY = 'splash_shown_session'

export default function AppSplash() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) return
    setVisible(true)
    sessionStorage.setItem(SPLASH_KEY, '1')
    const id = window.setTimeout(() => setVisible(false), 2400)
    return () => window.clearTimeout(id)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--app-bg)] px-8"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <p
        className="amiri text-center text-[clamp(1.5rem,6vw,2.25rem)] leading-[2.2] text-teal-600 dark:text-teal-400"
        dir="rtl"
        lang="ar"
      >
        {BISMILLAH}
      </p>
      <p className="home-serif mt-6 text-lg font-semibold tracking-wide text-[var(--home-sage-deep)] dark:text-[#c5d9ab]">
        {APP_NAME}
      </p>
    </div>
  )
}
