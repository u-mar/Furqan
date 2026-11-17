'use client'

import { useEffect } from 'react'

/**
 * While the screen using it is open, the dark theme's accent is white, as on Home, rather than a
 * colour: everywhere, so sheets and pop-ups opened from that screen match it.
 * The colours are in app/globals.css (html.dark.accent-neutral).
 */
export function useNeutralAccent(): void {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('accent-neutral')
    return () => root.classList.remove('accent-neutral')
  }, [])
}
