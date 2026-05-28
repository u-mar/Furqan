'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import {
  isPageFontLoaded,
  loadPageFont,
  preloadPageFontLink,
  prefetchPageFonts,
} from '@/lib/mushaf-fonts'

export interface QcfFontStatus {
  ready: boolean
  failed: boolean
  loading: boolean
}

export function useQcfFont(page: number, enabled = true): QcfFontStatus {
  const [ready, setReady] = useState(() => enabled && isPageFontLoaded(page))
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(() => enabled && !isPageFontLoaded(page))

  // Avoid one frame of page N content with page N-1 font (shows glyphs then error).
  useLayoutEffect(() => {
    if (!enabled) return
    if (isPageFontLoaded(page)) {
      setReady(true)
      setFailed(false)
      setLoading(false)
      return
    }
    setReady(false)
    setFailed(false)
    setLoading(true)
  }, [enabled, page])

  useEffect(() => {
    if (!enabled) {
      setReady(false)
      setFailed(false)
      setLoading(false)
      return
    }

    if (isPageFontLoaded(page)) {
      setReady(true)
      setFailed(false)
      setLoading(false)
      preloadPageFontLink(page)
      if (page < 604) preloadPageFontLink(page + 1)
      if (page > 1) preloadPageFontLink(page - 1)
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
