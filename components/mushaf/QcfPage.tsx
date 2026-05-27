'use client'

import { memo, useMemo } from 'react'
import { cn } from '@/lib/cn'
import QcfLine from '@/components/mushaf/QcfLine'
import { buildMushafPageModel } from '@/lib/mushaf-engine'
import { qcfFontFamily } from '@/lib/mushaf-fonts'
import type { Verse } from '@/types'

export interface QcfPageProps {
  verses: Verse[]
  pageNumber: number
  immersive?: boolean
  fontReady?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
}

function QcfPageComponent({
  verses,
  pageNumber,
  immersive = false,
  fontReady = true,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
}: QcfPageProps) {
  const model = useMemo(() => buildMushafPageModel(verses, pageNumber), [verses, pageNumber])
  const qcfFamily = qcfFontFamily(pageNumber)

  if (!fontReady) {
    return (
      <div className={cn('qcf-page qcf-page--loading', immersive && 'qcf-page--immersive')}>
        <p className="qcf-page__status">Loading mushaf font…</p>
      </div>
    )
  }

  return (
    <div
      className={cn('qcf-page', immersive && 'qcf-page--immersive')}
      data-page={pageNumber}
      dir="rtl"
      lang="ar"
      aria-label={`Quran page ${pageNumber}`}
    >
      <div className="qcf-page__lines">
        {model.lines.map((line) => (
          <QcfLine
            key={line.lineNumber}
            line={line}
            fontFamily={qcfFamily}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={selectedVerseKey}
            onLineLongPress={onAyahLongPress}
          />
        ))}
      </div>
    </div>
  )
}

const QcfPage = memo(QcfPageComponent)
export default QcfPage
