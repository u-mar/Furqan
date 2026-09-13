'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { stopListenAudio } from '@/lib/listen-audio'

/**
 * Listen keeps playing as you move around the app — stepping back to the home
 * screen should not cut a recitation off mid-ayah.
 *
 * These three screens are the exceptions: each has audio or attention of its
 * own, and leaving a surah running underneath them is never what was meant.
 */
const SILENCES_LISTEN = ['/read', '/test', '/qari']

export default function ListenPlaybackGuard() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    const conflicts = SILENCES_LISTEN.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
    if (conflicts) stopListenAudio()
  }, [pathname])

  return null
}
