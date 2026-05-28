'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import QcfPage from '@/components/mushaf/QcfPage'
import { useQcfFont } from '@/hooks/useQcfFont'
import { loadSurahNameFont, prefetchPageFonts } from '@/lib/mushaf-fonts'
import type { Verse } from '@/types'

export interface MushafPageViewProps {
  verses: Verse[]
  pageNumber: number
  immersive?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
  className?: string
}

export default function MushafPageView({
  verses,
  pageNumber,
  immersive = true,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
  className,
}: MushafPageViewProps) {
  const { ready: fontReady } = useQcfFont(pageNumber, pageNumber > 0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadSurahNameFont()
    if (pageNumber > 0) prefetchPageFonts(pageNumber, 2)
  }, [pageNumber])

  useEffect(() => {
    const key = highlightedVerseKey || selectedVerseKey
    if (!key || !rootRef.current) return
    const line = rootRef.current.querySelector(`[data-verse-keys~="${key}"]`)
    line?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightedVerseKey, selectedVerseKey])

  return (
    <div ref={rootRef} className={cn('mushaf-engine-root h-full w-full', className)}>
      <QcfPage
        verses={verses}
        pageNumber={pageNumber}
        immersive={immersive}
        fontReady={fontReady}
        highlightedVerseKey={highlightedVerseKey}
        selectedVerseKey={selectedVerseKey}
        onAyahLongPress={onAyahLongPress}
      />
    </div>
  )
}
