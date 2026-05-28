'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import QcfPage from '@/components/mushaf/QcfPage'
import { qcfPageFontFamily } from '@/lib/qcf-font-cdn'
import { loadSurahNameFont } from '@/lib/mushaf-fonts'
import type { Verse } from '@/types'

export interface MushafPageViewProps {
  verses: Verse[]
  pageNumber: number
  immersive?: boolean
  fontReady?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
  className?: string
}

export default function MushafPageView({
  verses,
  pageNumber,
  immersive = true,
  fontReady = false,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
  className,
}: MushafPageViewProps) {
  const qcfFamily = qcfPageFontFamily(pageNumber)
  const rootRef = useRef<HTMLDivElement>(null)
  const mushafFontStyle = {
    fontFamily: qcfFamily,
    ['--mushaf-qcf-font-family' as string]: qcfFamily,
  }

  useEffect(() => {
    void loadSurahNameFont()
  }, [])

  useEffect(() => {
    const key = highlightedVerseKey || selectedVerseKey
    if (!key || !rootRef.current) return
    const line = rootRef.current.querySelector(`[data-verse-keys~="${key}"]`)
    line?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightedVerseKey, selectedVerseKey])

  return (
    <div
      ref={rootRef}
      className={cn('mushaf-root mushaf-engine-root h-full w-full', className)}
      style={mushafFontStyle}
      data-qcf-font={qcfFamily}
    >
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
