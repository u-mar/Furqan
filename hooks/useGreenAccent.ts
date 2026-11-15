'use client'

import { useEffect } from 'react'

/**
 * While the screen using it is open, the black theme's accent is the green it had before
 * rather than blue — everywhere, so sheets and pop-ups opened from that screen match it.
 * The colours are in app/globals.css (html.dark.black.accent-green).
 */
export function useGreenAccent(): void {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('accent-green')
    return () => root.classList.remove('accent-green')
  }, [])
}
