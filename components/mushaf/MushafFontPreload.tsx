'use client'

import { useEffect } from 'react'
import { prefetchPageFonts } from '@/lib/mushaf-fonts'

interface MushafFontPreloadProps {
  /** Mushaf page to warm fonts for (defaults to 1). */
  page?: number
}

/** Preloads per-page QCF v2 WOFF2 fonts to reduce Android Chrome fallback. */
export default function MushafFontPreload({ page = 1 }: MushafFontPreloadProps) {
  useEffect(() => {
    if (page < 1 || page > 604) return
    prefetchPageFonts(page, 1)
  }, [page])

  return null
}
