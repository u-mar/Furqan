'use client'

import { useEffect, useState } from 'react'
import { APP_ICON_LETTER } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

const SHOWN_KEY = 'nadir-splash-shown'
const SHOW_MS = 1200
const FADE_MS = 500

/**
 * A brief branded cover shown once per app open, over the manifest's own
 * black background — the OS-generated PWA splash can only show the icon, so
 * this is what carries the verse and settles the "N" mark below it.
 */
export default function SplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'hidden'>('visible')

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SHOWN_KEY) === '1') {
        setPhase('hidden')
        return
      }
      sessionStorage.setItem(SHOWN_KEY, '1')
    } catch {
      /* private mode — just show it once, no persistence needed */
    }
    const fadeTimer = setTimeout(() => setPhase('fading'), SHOW_MS)
    const hideTimer = setTimeout(() => setPhase('hidden'), SHOW_MS + FADE_MS)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden
      className={cn(
        'fixed inset-0 z-[300] flex flex-col items-center bg-black px-8 pb-24 pt-[max(6rem,env(safe-area-inset-top))] transition-opacity ease-out',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <p
        dir="rtl"
        lang="ar"
        className="amiri mx-auto max-w-xs text-center text-2xl leading-relaxed text-[#f5ecd8]"
      >
        أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
      </p>
      <span
        className="mt-auto text-5xl leading-none text-[#f5ecd8]"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {APP_ICON_LETTER}
      </span>
    </div>
  )
}
