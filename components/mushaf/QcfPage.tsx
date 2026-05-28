'use client'

import { memo, useMemo } from 'react'
import { cn } from '@/lib/cn'
import QcfLine from '@/components/mushaf/QcfLine'
import { buildQcfPageLayout, qcfPageFontClass, qcfPageFontFamily } from '@/lib/qcf-page'
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
  const layout = useMemo(() => buildQcfPageLayout(verses, pageNumber), [verses, pageNumber])
  const qcfFamily = qcfPageFontFamily(pageNumber)
  const pageClass = qcfPageFontClass(pageNumber)

  if (!fontReady) {
    return null
  }

  return (
    <div
      className={cn(
        'mushaf-qcf-page',
        immersive && 'mushaf-qcf-page--immersive',
        pageClass
      )}
      data-page={pageNumber}
      data-qcf-font={qcfFamily}
      dir="rtl"
      lang="ar"
      aria-label={`Quran page ${pageNumber}`}
      style={{ fontFamily: qcfFamily }}
    >
      <div className="mushaf-fit-grid mushaf-qcf-page-content">
        {layout.lines.map((line) => (
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
