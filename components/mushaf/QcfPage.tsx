'use client'

import { memo, useMemo } from 'react'
import { cn } from '@/lib/cn'
import QcfLine from '@/components/mushaf/QcfLine'
import { buildQcfPageLayout, qcfPageFontClass, qcfPageFontFamily } from '@/lib/qcf-page'
import { getQcfLineRevealState } from '@/lib/qcf-reveal'
import type { Verse } from '@/types'

export interface QcfPageProps {
  verses: Verse[]
  pageNumber: number
  immersive?: boolean
  fontReady?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
  /** Hifdh test: hide unrevealed ayahs and tap to reveal the next one. */
  hifdhReveal?: {
    startVerseKey: string
    revealedAyahs: Set<string>
    revealableVerseKeys: Set<string>
    nextVerseKey: string | null
    onReveal: (verseKey: string) => void
  }
}

function QcfPageComponent({
  verses,
  pageNumber,
  immersive = false,
  fontReady = true,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
  hifdhReveal,
}: QcfPageProps) {
  const layout = useMemo(() => buildQcfPageLayout(verses, pageNumber), [verses, pageNumber])
  const qcfFamily = qcfPageFontFamily(pageNumber)
  const pageClass = qcfPageFontClass(pageNumber)
  const startIndex = hifdhReveal
    ? verses.findIndex((verse) => verse.verse_key === hifdhReveal.startVerseKey)
    : -1

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
    >
      <div className="mushaf-fit-grid mushaf-qcf-page-content">
        {layout.lines.map((line) => {
          const revealState = hifdhReveal
            ? getQcfLineRevealState(line, {
                verses,
                startIndex,
                revealedAyahs: hifdhReveal.revealedAyahs,
                revealableVerseKeys: hifdhReveal.revealableVerseKeys,
                nextVerseKey: hifdhReveal.nextVerseKey,
              })
            : 'shown'

          return (
            <QcfLine
              key={line.lineNumber}
              line={line}
              qcfFontFamily={qcfFamily}
              highlightedVerseKey={highlightedVerseKey}
              selectedVerseKey={selectedVerseKey}
              onLineLongPress={onAyahLongPress}
              revealState={revealState}
              nextVerseKey={hifdhReveal?.nextVerseKey ?? null}
              onReveal={hifdhReveal?.onReveal}
            />
          )
        })}
      </div>
    </div>
  )
}

const QcfPage = memo(QcfPageComponent)
export default QcfPage
