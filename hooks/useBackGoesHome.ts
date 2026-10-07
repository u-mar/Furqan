'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cameBack, cameFrom } from '@/lib/nav-trail'

/** Marks the history entry under this screen: landing on it means Back was pressed. */
const MARK = 'nadirBackHome'
/** The entry above it, so the copy is slipped in only once. */
const ABOVE = 'nadirAboveHome'

/**
 * Back from this screen goes Home, wherever it was opened from (Qari, Listen,
 * a shared link), instead of to the screen before it.
 *
 * Opening it from anywhere but Home slips a copy of this screen under it,
 * marked. Back lands on that copy, which shows the same screen, and it is then
 * swapped for Home, so nothing else flashes on the way.
 */
export function useBackGoesHome(): void {
  const router = useRouter()
  // Read while first drawn: once this screen has shown, the trail moves on to it.
  const [opened] = useState(() => ({ from: cameFrom(), back: cameBack() }))

  useEffect(() => {
    const goHomeIfMarked = () => {
      if ((window.history.state as Record<string, unknown> | null)?.[MARK]) router.replace('/')
    }

    // Arrived on the marked copy itself (Back from a screen opened after this one).
    goHomeIfMarked()

    const state = (window.history.state ?? {}) as Record<string, unknown>
    if (!opened.back && opened.from !== '/' && !state[MARK] && !state[ABOVE]) {
      const url = window.location.href
      // Keeping the router's own fields on both entries lets it restore this screen as it is.
      window.history.replaceState({ ...state, [MARK]: true }, '', url)
      window.history.pushState({ ...state, [ABOVE]: true }, '', url)
    }

    window.addEventListener('popstate', goHomeIfMarked)
    return () => window.removeEventListener('popstate', goHomeIfMarked)
  }, [router, opened])
}
