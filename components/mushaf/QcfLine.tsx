'use client'

import { memo, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { BASMALAH_ARABIC, BASMALAH_ORNAMENT } from '@/lib/mushaf-basmalah'
import type { QcfPageLine, QcfPageSegment } from '@/lib/qcf-page'
import type { QcfLineRevealState } from '@/lib/qcf-reveal'
import { useT } from '@/lib/i18n'

function QcfSegment({
  segment,
  index,
  highlightedVerseKey,
  selectedVerseKey,
  onLongPress,
  onSelect,
  ayahSelectMode,
  hidden,
}: {
  segment: QcfPageSegment
  index: number
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onLongPress?: (verseKey: string) => void
  onSelect?: (verseKey: string) => void
  ayahSelectMode?: boolean
  /** Hifdh Test: keeps this word's shaped width so lines don't reflow, but paints nothing. */
  hidden?: boolean
}) {
  const longPress = useLongPress(() => onLongPress?.(segment.verseKey))
  // The ayah-number ornament never gets a highlight wash — only the words
  // themselves — whether that's from playback or from a long-press selection.
  const isReciting = highlightedVerseKey === segment.verseKey && !segment.isEnd
  const isSelected = selectedVerseKey === segment.verseKey && !isReciting && !segment.isEnd

  return (
    <span
      key={`${segment.verseKey}-${index}`}
      data-verse-key={segment.verseKey}
      className={cn(
        'mushaf-qcf-segment',
        segment.isEnd && 'mushaf-qcf-segment--end',
        (onLongPress || onSelect) && 'mushaf-qcf-segment--pressable',
        isReciting && 'mushaf-qcf-segment--reciting',
        isSelected && 'mushaf-qcf-segment--selected',
        hidden && 'mushaf-qcf-segment--hidden'
      )}
      aria-hidden={hidden}
      {...(onLongPress ? longPress.handlers : {})}
      onClick={(e) => {
        if (!ayahSelectMode || !onSelect) return
        e.stopPropagation()
        onSelect(segment.verseKey)
      }}
    >
      {segment.text}
    </span>
  )
}

/**
 * Sizing happens once per page, not here — see `fitQcfPageLines` in
 * `QcfPage.tsx`. Every content line on a page must land on the same final
 * font size, so one unusually wide line doesn't get shrunk on its own while
 * its neighbours stay at full size, which is what made some words look
 * bigger than others on the same page.
 */
function QcfLineGlyphs({
  segments,
  style,
  invisible,
  highlightedVerseKey,
  selectedVerseKey,
  onSegmentLongPress,
  onSegmentSelect,
  ayahSelectMode,
  isSegmentHidden,
}: {
  segments: QcfPageSegment[]
  style: CSSProperties
  invisible?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onSegmentLongPress?: (verseKey: string) => void
  onSegmentSelect?: (verseKey: string) => void
  ayahSelectMode?: boolean
  /** Hifdh Test: per-word visibility (independent of the whole-line `invisible` toggle). */
  isSegmentHidden?: (segment: QcfPageSegment, index: number) => boolean
}) {
  return (
    <div className="mushaf-qcf-line__scale">
      <span
        className={cn('mushaf-qcf-line__glyphs', invisible && 'mushaf-qcf-line__glyphs--hidden')}
        style={style}
        aria-hidden={invisible}
      >
        {segments.map((segment, index) => (
          <QcfSegment
            key={`${segment.verseKey}-${index}`}
            segment={segment}
            index={index}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={selectedVerseKey}
            onLongPress={onSegmentLongPress}
            onSelect={onSegmentSelect}
            ayahSelectMode={ayahSelectMode}
            hidden={isSegmentHidden?.(segment, index)}
          />
        ))}
      </span>
    </div>
  )
}

export interface QcfLineProps {
  line: QcfPageLine
  qcfFontFamily: string
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onLineLongPress?: (verseKey: string) => void
  onAyahSelect?: (verseKey: string) => void
  ayahSelectMode?: boolean
  revealState?: QcfLineRevealState
  nextVerseKey?: string | null
  onReveal?: (verseKey: string) => void
  isSegmentHidden?: (segment: QcfPageSegment, index: number) => boolean
}

function QcfLineComponent({
  line,
  qcfFontFamily,
  highlightedVerseKey,
  selectedVerseKey,
  onLineLongPress,
  onAyahSelect,
  ayahSelectMode = false,
  revealState = 'shown',
  nextVerseKey = null,
  onReveal,
  isSegmentHidden,
}: QcfLineProps) {
  const t = useT()
  const glyphStyle = { fontFamily: `"${qcfFontFamily}", serif` } as const
  const segmentLongPress =
    onLineLongPress && line.kind !== 'empty' && line.kind !== 'surah-header'
      ? onLineLongPress
      : undefined

  if (revealState === 'hidden') {
    return (
      <div
        className="mushaf-fit-line mushaf-qcf-line mushaf-qcf-line--empty"
        data-line={line.lineNumber}
        aria-hidden
      />
    )
  }

  const rowClass = cn(
    'mushaf-fit-line',
    'mushaf-qcf-line',
    line.kind === 'empty' && 'mushaf-qcf-line--empty',
    line.kind === 'surah-header' && 'mushaf-qcf-line--surah-header',
    line.kind === 'basmalah' && 'mushaf-qcf-line--basmalah',
    revealState === 'tap' && 'mushaf-qcf-line--reveal-target'
  )

  const content =
    line.kind === 'surah-header' ? (
      <span className="mushaf-qcf-line__surah-name">{line.text}</span>
    ) : line.kind === 'basmalah' ? (
      <span className="mushaf-qcf-line__glyphs" style={glyphStyle} aria-label={BASMALAH_ARABIC}>
        {BASMALAH_ORNAMENT}
      </span>
    ) : line.kind === 'empty' ? null : (
      <QcfLineGlyphs
        segments={line.segments}
        style={glyphStyle}
        invisible={revealState === 'tap'}
        isSegmentHidden={isSegmentHidden}
        highlightedVerseKey={highlightedVerseKey}
        selectedVerseKey={selectedVerseKey}
        onSegmentLongPress={segmentLongPress}
        onSegmentSelect={ayahSelectMode ? onAyahSelect : undefined}
        ayahSelectMode={ayahSelectMode}
      />
    )

  if (revealState === 'tap' && nextVerseKey && onReveal) {
    return (
      <button
        type="button"
        className={rowClass}
        data-line={line.lineNumber}
        data-verse-keys={line.verseKeys.join(' ')}
        dir="rtl"
        lang="ar"
        onClick={() => onReveal(nextVerseKey)}
        aria-label={t('Reveal ayah {nextVerseKey}', { nextVerseKey })}
      >
        {content}
      </button>
    )
  }

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

const QcfLine = memo(QcfLineComponent)
export default QcfLine
