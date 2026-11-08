'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { isPageFontLoaded, loadPageFont, prefetchPageFonts } from '@/lib/mushaf-fonts'

export interface QcfFontStatus {
  ready: boolean
  failed: boolean
  loading: boolean
}

export function useQcfFont(
  page: number,
  enabled = true,
  sampleGlyphs = '',
  /** One of many rows on unrelated pages: load lightly, and don't fetch the pages either side. */
  listRow = false
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

    void loadPageFont(page, sampleGlyphs, listRow).then((ok) => {
      if (cancelled) return
      setReady(ok)
      setFailed(!ok)
      setLoading(false)
      if (ok && !listRow) prefetchPageFonts(page, 1)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, page, sampleGlyphs, listRow])

  return { ready, failed, loading }
}
