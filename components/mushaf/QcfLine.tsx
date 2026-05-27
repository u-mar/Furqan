'use client'

import { memo } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { surahHeaderToken } from '@/lib/mushaf-engine'
import type { MushafLineModel } from '@/lib/mushaf-engine'

export interface QcfLineProps {
  line: MushafLineModel
  fontFamily: string
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onLineLongPress?: (verseKey: string) => void
}

function lineVerseKey(line: MushafLineModel): string | null {
  if (line.verseKeys.length === 1) return line.verseKeys[0]
  if (line.verseKeys.length > 1) return line.verseKeys[line.verseKeys.length - 1]
  return null
}

function QcfLineComponent({
  line,
  fontFamily,
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

  const className = cn(
    'qcf-line',
    line.kind === 'empty' && 'qcf-line--empty',
    line.kind === 'surah-header' && 'qcf-line--surah-header',
    line.kind === 'basmalah' && 'qcf-line--basmalah',
    isReciting && 'qcf-line--reciting',
    isSelected && 'qcf-line--selected'
  )

  const content =
    line.kind === 'surah-header' && line.chapterNumber ? (
      <span className="qcf-line__surah-name" aria-label={`Surah ${line.chapterNumber}`}>
        {surahHeaderToken(line.chapterNumber)}
      </span>
    ) : (
      <span className="qcf-line__glyphs" style={{ fontFamily }}>
        {line.glyphs}
      </span>
    )

  if (!onLineLongPress || !pressKey || line.kind === 'empty' || line.kind === 'surah-header') {
    return (
      <div
        className={className}
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
      className={className}
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
