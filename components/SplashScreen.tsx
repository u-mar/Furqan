'use client'

import { useEffect, useState } from 'react'
import { APP_ICON_LETTER } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

const SHOWN_KEY = 'nadir-splash-shown'
const SHOW_MS = 1200
const FADE_MS = 500
const INK = '#f5ecd8'

/**
 * A brief branded cover shown once per app open, over the manifest's own
 * black background — the OS-generated PWA splash can only show the icon, so
 * this is what carries the verse. The mark below it is set as SVG text in
 * Amiri (not Georgia, which has no Arabic coverage and was falling back to
 * whatever Arabic font the OS happened to have) so it centers on its own
 * glyph metrics rather than CSS line-height, which reads oddly for a single
 * harakat-free Arabic letter.
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
        'fixed inset-0 z-[300] flex flex-col items-center justify-center gap-10 bg-black px-10 transition-opacity ease-out',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <p
        dir="rtl"
        lang="ar"
        className="mx-auto max-w-xs text-center"
        style={{
          fontFamily: 'var(--font-amiri), Amiri, serif',
          fontWeight: 700,
          fontSize: 'clamp(26px, 6.5vw, 34px)',
          lineHeight: 2,
          color: INK,
        }}
      >
        أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
      </p>

      <svg width="56" height="56" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <text
          x="50"
          y="54"
          textAnchor="middle"
          dominantBaseline="central"
          fill={INK}
          style={{ fontFamily: 'var(--font-amiri), Amiri, serif', fontWeight: 700 }}
          fontSize="72"
        >
          {APP_ICON_LETTER}
        </text>
      </svg>
    </div>
  )
}
