'use client'

import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import type { QcfPageLine } from '@/lib/qcf-page'
import type { QcfLineRevealState } from '@/lib/qcf-reveal'

/** Fit long lines by font size (not scale) so QCF glyphs do not overlap at line starts. */
function QcfLineGlyphs({
  text,
  style,
  invisible,
}: {
  text: string
  style: CSSProperties
  invisible?: boolean
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
  }, [text])

  return (
    <div ref={outerRef} className="mushaf-qcf-line__scale">
      <span
        ref={innerRef}
        className={cn('mushaf-qcf-line__glyphs', invisible && 'mushaf-qcf-line__glyphs--hidden')}
        style={style}
        aria-hidden={invisible}
      >
        {text}
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

function lineVerseKey(line: QcfPageLine): string | null {
  if (line.verseKeys.length === 1) return line.verseKeys[0]
  if (line.verseKeys.length > 1) return line.verseKeys[line.verseKeys.length - 1]
  return null
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
  const longPress = useLongPress(() => {
    const key = lineVerseKey(line)
    if (key) onLineLongPress?.(key)
  })
  const activeVerse = line.verseKeys.find((k) => k === highlightedVerseKey)
  const selectedVerse = line.verseKeys.find((k) => k === selectedVerseKey)
  const isReciting = Boolean(activeVerse)
  const isSelected = Boolean(selectedVerse) && !isReciting
  const pressKey = lineVerseKey(line)

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
    isReciting && 'mushaf-qcf-line--reciting',
    isSelected && 'mushaf-qcf-line--selected',
    revealState === 'tap' && 'mushaf-qcf-line--reveal-target'
  )

  const content =
    line.kind === 'surah-header' ? (
      <span className="mushaf-qcf-line__surah-name">{line.text}</span>
    ) : line.kind === 'empty' ? null : (
      <QcfLineGlyphs
        text={line.text}
        style={glyphStyle}
        invisible={revealState === 'tap'}
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
