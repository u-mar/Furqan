'use client'

import { useEffect, useState } from 'react'
import { loadPageFont, prefetchPageFonts } from '@/lib/mushaf-fonts'

export function useQcfFont(page: number, enabled = true): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setReady(false)
      return
    }

    let cancelled = false
    setReady(false)

    void loadPageFont(page).then((ok) => {
      if (cancelled) return
      setReady(ok)
      if (ok) prefetchPageFonts(page, 2)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, page])

  return ready
}
