'use client'

import { useEffect, useState } from 'react'
import { APP_ICON_LETTER, APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

const SHOWN_KEY = 'nadir-splash-shown'
const SHOW_MS = 1200
const FADE_MS = 500
const INK = '#f5ecd8'

/**
 * A brief branded cover shown once per app open, over the manifest's own
 * black background — the OS-generated PWA splash can only show the icon, so
 * this is what carries the verse.
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
        'fixed inset-0 z-[300] flex flex-col items-center bg-black px-8 transition-opacity ease-out',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        paddingTop: 'max(4.5rem, env(safe-area-inset-top) + 2.5rem)',
        paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom) + 1.5rem)',
      }}
    >
      <p
        dir="rtl"
        lang="ar"
        className="mx-auto max-w-sm text-center"
        style={{
          fontFamily: 'var(--font-amiri), Amiri, serif',
          fontWeight: 700,
          fontSize: 'clamp(32px, 8.5vw, 44px)',
          lineHeight: 2.05,
          color: INK,
          textShadow: '0 0 28px rgba(245, 236, 216, 0.22)',
        }}
      >
        أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
      </p>

      <div className="mt-auto flex items-center gap-2.5">
        <svg width="30" height="30" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="4" width="92" height="92" rx="22" fill="none" stroke={INK} strokeWidth="6" />
          <text
            x="50"
            y="54"
            textAnchor="middle"
            dominantBaseline="central"
            fill={INK}
            style={{ fontFamily: 'var(--font-amiri), Amiri, serif', fontWeight: 700 }}
            fontSize="58"
          >
            {APP_ICON_LETTER}
          </text>
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-home-serif), Fraunces, Georgia, serif',
            fontWeight: 600,
            fontSize: '17px',
            letterSpacing: '0.01em',
            color: INK,
          }}
        >
          {APP_NAME} App
        </span>
      </div>
    </div>
  )
}
