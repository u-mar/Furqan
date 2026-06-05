'use client'

import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { BASMALAH_ARABIC, BASMALAH_ORNAMENT } from '@/lib/mushaf-basmalah'
import type { QcfPageLine, QcfPageSegment } from '@/lib/qcf-page'
import type { QcfLineRevealState } from '@/lib/qcf-reveal'

function QcfSegment({
  segment,
  index,
  highlightedVerseKey,
  selectedVerseKey,
  onLongPress,
}: {
  segment: QcfPageSegment
  index: number
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onLongPress?: (verseKey: string) => void
}) {
  const longPress = useLongPress(() => onLongPress?.(segment.verseKey))
  const isReciting = highlightedVerseKey === segment.verseKey
  const isSelected = selectedVerseKey === segment.verseKey && !isReciting

  return (
    <span
      key={`${segment.verseKey}-${index}`}
      data-verse-key={segment.verseKey}
      className={cn(
        'mushaf-qcf-segment',
        onLongPress && 'mushaf-qcf-segment--pressable',
        isReciting && 'mushaf-qcf-segment--reciting',
        isSelected && 'mushaf-qcf-segment--selected'
      )}
      {...(onLongPress ? longPress.handlers : {})}
    >
      {segment.text}
    </span>
  )
}

/** Fit long lines by font size (not scale) so QCF glyphs do not overlap at line starts. */
function QcfLineGlyphs({
  segments,
  style,
  invisible,
  highlightedVerseKey,
  selectedVerseKey,
  onSegmentLongPress,
}: {
  segments: QcfPageSegment[]
  style: CSSProperties
  invisible?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onSegmentLongPress?: (verseKey: string) => void
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const fit = () => {
      inner.style.transform = 'none'
      inner.style.fontSize = ''

      const available = outer.clientWidth * 0.92
      let needed = inner.scrollWidth
      if (needed <= available || available <= 0) return

      const basePx = parseFloat(getComputedStyle(inner).fontSize)
      if (!Number.isFinite(basePx) || basePx <= 0) return

      const ratio = (available / needed) * 0.97
      inner.style.fontSize = `${Math.max(14, basePx * ratio)}px`
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [segments])

  return (
    <div ref={outerRef} className="mushaf-qcf-line__scale">
      <span
        ref={innerRef}
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
  revealState?: QcfLineRevealState
  nextVerseKey?: string | null
  onReveal?: (verseKey: string) => void
}

function QcfLineComponent({
  line,
  qcfFontFamily,
  highlightedVerseKey,
  selectedVerseKey,
  onLineLongPress,
  revealState = 'shown',
  nextVerseKey = null,
  onReveal,
}: QcfLineProps) {
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
        highlightedVerseKey={highlightedVerseKey}
        selectedVerseKey={selectedVerseKey}
        onSegmentLongPress={segmentLongPress}
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
        aria-label={`Reveal ayah ${nextVerseKey}`}
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
