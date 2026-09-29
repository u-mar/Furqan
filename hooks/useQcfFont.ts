'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import {
  isPageFontLoaded,
  isTajweedFontLoaded,
  loadPageFont,
  loadTajweedPageFont,
  prefetchPageFonts,
} from '@/lib/mushaf-fonts'

/** True once the page's tajweed font is usable; stays false (plain font) if it can't load. */
export function useTajweedFont(page: number, enabled: boolean): boolean {
  const [ready, setReady] = useState(() => enabled && isTajweedFontLoaded(page))

  useEffect(() => {
    if (!enabled || page < 1) {
      setReady(false)
      return
    }
    if (isTajweedFontLoaded(page)) {
      setReady(true)
      return
    }
    setReady(false)
    let cancelled = false
    void loadTajweedPageFont(page).then((ok) => {
      if (cancelled) return
      setReady(ok)
      if (ok) {
        if (page > 1) void loadTajweedPageFont(page - 1)
        if (page < 604) void loadTajweedPageFont(page + 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [enabled, page])

  return ready
}

export interface QcfFontStatus {
  ready: boolean
  failed: boolean
  loading: boolean
}

export function useQcfFont(
  page: number,
  enabled = true,
  sampleGlyphs = ''
): QcfFontStatus {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)

  useLayoutEffect(() => {
    if (!enabled || page < 1) {
      setReady(false)
      setFailed(false)
      setLoading(false)
      return
    }

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
    if (!enabled || page < 1) {
      setReady(false)
      setFailed(false)
      setLoading(false)
      return
    }

    let cancelled = false

    void loadPageFont(page, sampleGlyphs).then((ok) => {
      if (cancelled) return
      setReady(ok)
      setFailed(!ok)
      setLoading(false)
      if (ok) prefetchPageFonts(page, 1)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, page, sampleGlyphs])

  return { ready, failed, loading }
}
