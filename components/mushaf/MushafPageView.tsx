'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import QcfPage from '@/components/mushaf/QcfPage'
import { qcfPageFontFamily, qcfTajweedFontFamily } from '@/lib/qcf-font-cdn'
import { loadSurahNameFont } from '@/lib/mushaf-fonts'
import type { Verse } from '@/types'

export interface MushafPageViewProps {
  verses: Verse[]
  pageNumber: number
  immersive?: boolean
  scrollable?: boolean
  fontReady?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
  onAyahSelect?: (verseKey: string) => void
  ayahSelectMode?: boolean
  suppressHighlightScroll?: boolean
  hifdhReveal?: {
    startVerseKey: string
    revealedAyahs: Set<string>
    revealableVerseKeys: Set<string>
    nextVerseKey: string | null
    onReveal: (verseKey: string) => void
  }
  className?: string
  /** Render with the page's tajweed (colour) font — it must already be loaded. */
  tajweed?: boolean
}

export default function MushafPageView({
  verses,
  pageNumber,
  immersive = true,
  scrollable = false,
  fontReady = false,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
  onAyahSelect,
  ayahSelectMode = false,
  suppressHighlightScroll = false,
  hifdhReveal,
  className,
  tajweed = false,
}: MushafPageViewProps) {
  const qcfFamily = tajweed ? qcfTajweedFontFamily(pageNumber) : qcfPageFontFamily(pageNumber)
  const rootRef = useRef<HTMLDivElement>(null)
  const mushafFontStyle = {
    fontFamily: qcfFamily,
    ['--mushaf-qcf-font-family' as string]: qcfFamily,
  }

  useEffect(() => {
    void loadSurahNameFont()
  }, [])

  useEffect(() => {
    if (suppressHighlightScroll || immersive) return
    const key = highlightedVerseKey || selectedVerseKey
    if (!key || !rootRef.current) return
    const line = rootRef.current.querySelector(`[data-verse-keys~="${key}"]`)
    line?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightedVerseKey, selectedVerseKey, suppressHighlightScroll, immersive])

  return (
    <div
      ref={rootRef}
      className={cn('mushaf-root mushaf-engine-root h-full w-full', tajweed && 'mushaf-tajweed', className)}
      style={mushafFontStyle}
      data-qcf-font={qcfFamily}
    >
      <QcfPage
        verses={verses}
        pageNumber={pageNumber}
        fontFamily={qcfFamily}
        immersive={immersive}
        scrollable={scrollable}
        fontReady={fontReady}
        highlightedVerseKey={highlightedVerseKey}
        selectedVerseKey={selectedVerseKey}
        onAyahLongPress={onAyahLongPress}
        onAyahSelect={onAyahSelect}
        ayahSelectMode={ayahSelectMode}
        hifdhReveal={hifdhReveal}
      />
    </div>
  )
}
