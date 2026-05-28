'use client'

import { useEffect, useState } from 'react'
import { loadPageFont, preloadPageFontLink, prefetchPageFonts } from '@/lib/mushaf-fonts'

export interface QcfFontStatus {
  ready: boolean
  failed: boolean
  loading: boolean
}

export function useQcfFont(page: number, enabled = true): QcfFontStatus {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setReady(false)
      setFailed(false)
      setLoading(false)
      return
    }

    let cancelled = false
    setReady(false)
    setFailed(false)
    setLoading(true)

    preloadPageFontLink(page)
    if (page < 604) preloadPageFontLink(page + 1)
    if (page > 1) preloadPageFontLink(page - 1)

    void loadPageFont(page).then((ok) => {
      if (cancelled) return
      setReady(ok)
      setFailed(!ok)
      setLoading(false)
      if (ok) prefetchPageFonts(page, 2)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, page])

  return { ready, failed, loading }
}
