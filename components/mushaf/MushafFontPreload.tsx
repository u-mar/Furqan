'use client'

import { useEffect } from 'react'
import { loadSurahNameFont } from '@/lib/mushaf-fonts'

/** Warm surah header font only — page QCF fonts load in QuranPageView. */
export default function MushafFontPreload() {
  useEffect(() => {
    void loadSurahNameFont()
  }, [])

  return null
}
