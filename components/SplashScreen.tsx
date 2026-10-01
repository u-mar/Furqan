'use client'

import { useEffect, useState } from 'react'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'
import { SPLASH_AYAH_PATH, SPLASH_AYAH_VIEWBOX } from '@/components/splash-ayah-paths'

const SHOWN_KEY = 'nadir-splash-shown'
const SHOW_MS = 1500
const FADE_MS = 550

/**
 * A brief cover shown once per app open, over the manifest's own black
 * background — the OS-generated PWA splash can only show the icon, so this is
 * what carries the verse: أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ (13:28).
 *
 * The ayah is the mushaf's own script saved as outlines, so it is there on the
 * very first frame instead of waiting on a font. A tap skips it.
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
    const timer = setTimeout(() => setPhase('fading'), SHOW_MS)
    return () => clearTimeout(timer)
  }, [])

  // Gone once faded, whether by time or by a tap.
  useEffect(() => {
    if (phase !== 'fading') return
    const timer = setTimeout(() => setPhase('hidden'), FADE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'hidden') return null

  return (
    <div
      aria-hidden
      onClick={() => setPhase('fading')}
      className={cn(
        'app-splash fixed inset-0 z-[300] flex flex-col items-center px-6 transition-opacity ease-out',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{
        transitionDuration: `${FADE_MS}ms`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'max(2.25rem, env(safe-area-inset-bottom) + 1.25rem)',
      }}
    >
      <div className="flex w-full flex-1 items-center justify-center">
        <svg viewBox={SPLASH_AYAH_VIEWBOX} className="app-splash__ayah w-[min(88vw,380px)]" role="presentation">
          <path d={SPLASH_AYAH_PATH} fill="currentColor" />
        </svg>
      </div>

      <span className="app-splash__name">{APP_NAME}</span>
    </div>
  )
}
