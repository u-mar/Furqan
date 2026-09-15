'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { stopListening } from '@/lib/listen-player'
import { stopPlayback } from '@/lib/qari-player'

/**
 * Listen keeps playing as you move around the app — stepping back to the home
 * screen should not cut a recitation off mid-ayah.
 *
 * These two screens are the exceptions: each has audio or attention of its
 * own, and leaving a surah running underneath them is never what was meant.
 */
const SILENCES_LISTEN = ['/read', '/qari']

function within(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

export default function ListenPlaybackGuard() {
  const pathname = usePathname()
  const previous = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname) return
    if (SILENCES_LISTEN.some((route) => within(pathname, route))) stopListening()

    // A Qari recitation is controlled from its row, so it stops when you move
    // to a screen where that row is gone — and never runs into a recording.
    if (previous.current !== null && previous.current !== pathname) stopPlayback()
    previous.current = pathname
  }, [pathname])

  return null
}
