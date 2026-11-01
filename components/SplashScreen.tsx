'use client'

import { useEffect, useState } from 'react'
import LogoMark from '@/components/brand/LogoMark'
import { APP_NAME } from '@/lib/app-brand'
import { cn } from '@/lib/cn'

const SHOWN_KEY = 'nadir-splash-shown'
const SHOW_MS = 1500
const FADE_MS = 550

/**
 * A brief cover shown once per app open, over the manifest's own plain black
 * background: the logo in the middle, just where the phone's launch screen
 * leaves it, with the name fading in under it. A tap skips it.
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
        'app-splash fixed inset-0 z-[300] transition-opacity ease-out',
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <LogoMark className="app-splash__mark" />
      <span className="app-splash__name">{APP_NAME}</span>
    </div>
  )
}
