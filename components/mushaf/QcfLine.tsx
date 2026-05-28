'use client'

import { memo } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import type { QcfPageLine } from '@/lib/qcf-page'

export interface QcfLineProps {
  line: QcfPageLine
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onLineLongPress?: (verseKey: string) => void
}

function lineVerseKey(line: QcfPageLine): string | null {
  if (line.verseKeys.length === 1) return line.verseKeys[0]
  if (line.verseKeys.length > 1) return line.verseKeys[line.verseKeys.length - 1]
  return null
}

function QcfLineComponent({
  line,
  highlightedVerseKey,
  selectedVerseKey,
  onLineLongPress,
}: QcfLineProps) {
  const longPress = useLongPress(() => {
    const key = lineVerseKey(line)
    if (key) onLineLongPress?.(key)
  })
  const activeVerse = line.verseKeys.find((k) => k === highlightedVerseKey)
  const selectedVerse = line.verseKeys.find((k) => k === selectedVerseKey)
  const isReciting = Boolean(activeVerse)
  const isSelected = Boolean(selectedVerse) && !isReciting
  const pressKey = lineVerseKey(line)

  const rowClass = cn(
    'mushaf-fit-line',
    'mushaf-qcf-line',
    line.kind === 'empty' && 'mushaf-qcf-line--empty',
    line.kind === 'surah-header' && 'mushaf-qcf-line--surah-header',
    line.kind === 'basmalah' && 'mushaf-qcf-line--basmalah',
    isReciting && 'mushaf-qcf-line--reciting',
    isSelected && 'mushaf-qcf-line--selected'
  )

  const content =
    line.kind === 'surah-header' ? (
      <span className="mushaf-qcf-line__surah-name">{line.text}</span>
    ) : line.kind === 'empty' ? null : (
      <span className="mushaf-qcf-line__glyphs">{line.text}</span>
    )

  if (!onLineLongPress || !pressKey || line.kind === 'empty' || line.kind === 'surah-header') {
    return (
      <div
        className={rowClass}
        data-line={line.lineNumber}
        data-verse-keys={line.verseKeys.join(' ')}
        dir="rtl"
        lang="ar"
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={rowClass}
      data-line={line.lineNumber}
      data-verse-keys={line.verseKeys.join(' ')}
      dir="rtl"
      lang="ar"
      role="button"
      tabIndex={0}
      aria-label={`Ayah ${pressKey}`}
      {...longPress.handlers}
    >
      {content}
    </div>
  )
}

const QcfLine = memo(QcfLineComponent)
export default QcfLine
