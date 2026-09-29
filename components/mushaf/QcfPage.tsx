'use client'

import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'
import QcfLine, { QcfSegment } from '@/components/mushaf/QcfLine'
import {
  buildQcfPageLayout,
  qcfPageFontClass,
  qcfPageFontFamily,
  type QcfPageLayout,
  type QcfPageSegment,
} from '@/lib/qcf-page'
import { getQcfLineRevealState } from '@/lib/qcf-reveal'
import type { Verse } from '@/types'
import { useT } from '@/lib/i18n'

/**
 * Every content line on a page has to land on the same final font size.
 * Each line's QCF glyphs need different widths to say the same thing (an
 * ayah with more words needs to be smaller than one with few), so fitting
 * each line to its own column width independently left some lines shrunk
 * and others at full size — the same script looking like different sizes on
 * one page. This measures every content line first, then shrinks all of
 * them by whichever line needed it most.
 */
function useFitQcfPageLines(
  containerRef: React.RefObject<HTMLElement | null>,
  layout: QcfPageLayout,
  fontFamily: string
) {
  const isTajweed = /^QCF_T/.test(fontFamily)
  useLayoutEffect(() => {
    const container = containerRef.current
    const grid = container?.querySelector<HTMLElement>('.mushaf-fit-grid')
    if (!grid) return

    const fit = () => {
      const inners = Array.from(
        grid.querySelectorAll<HTMLElement>('.mushaf-qcf-line__scale .mushaf-qcf-line__glyphs')
      )
      if (inners.length === 0) return

      // A previous shrink would otherwise be measured as "already fits".
      for (const inner of inners) inner.style.fontSize = ''

      const fitVar = parseFloat(getComputedStyle(grid).getPropertyValue('--mushaf-line-fit'))
      const fitFactor = Number.isFinite(fitVar) && fitVar > 0 ? fitVar : 0.92

      let minRatio = 1
      // The ratio the widest line could grow by, for a page whose lines all come up short.
      let widestRatio = Infinity
      let basePx = 0
      for (const inner of inners) {
        if (!basePx) {
          const px = parseFloat(getComputedStyle(inner).fontSize)
          if (Number.isFinite(px) && px > 0) basePx = px
        }
        const lineEl = inner.closest<HTMLElement>('.mushaf-qcf-line')
        const lineCs = lineEl ? getComputedStyle(lineEl) : null
        const inset = lineCs
          ? (parseFloat(lineCs.paddingLeft) || 0) + (parseFloat(lineCs.paddingRight) || 0)
          : 0
        const available = (grid.clientWidth - inset) * fitFactor
        const needed = inner.scrollWidth
        if (available > 0 && needed > 0) widestRatio = Math.min(widestRatio, available / needed)
        if (available <= 0 || needed <= available) continue
        const ratio = (available / needed) * 0.995
        if (ratio < minRatio) minRatio = ratio
      }

      if (minRatio < 1 && basePx > 0) {
        const size = `${Math.max(14, basePx * minRatio)}px`
        for (const inner of inners) inner.style.fontSize = size
      } else if (isTajweed && basePx > 0 && Number.isFinite(widestRatio) && widestRatio > 1.02) {
        // The colour font's lines can run narrower than the plain one's, which left the
        // page thin with wide margins. Grow it to fill the width, a little at most so
        // it still fits between its neighbours.
        const size = `${basePx * Math.min(widestRatio * 0.995, 1.08)}px`
        for (const inner of inners) inner.style.fontSize = size
      }
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(grid)

    // Glyph widths change once the page's QCF font swaps in, so the first
    // measurement can under-report and skip the shrink. Re-fit when fonts settle.
    let cancelled = false
    const refit = () => {
      if (!cancelled) fit()
    }
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined
    fonts?.ready.then(refit).catch(() => {})
    fonts?.addEventListener?.('loadingdone', refit)

    return () => {
      cancelled = true
      observer.disconnect()
      fonts?.removeEventListener?.('loadingdone', refit)
    }
    // A family swap (e.g. into the wider tajweed font) keeps the same layout
    // but changes every glyph width, so it has to trigger a re-fit too.
  }, [containerRef, layout, fontFamily, isTajweed])
}

type FlowBlock =
  | { type: 'line'; line: QcfPageLayout['lines'][number] }
  | { type: 'text'; key: number; segments: QcfPageSegment[] }

/** Consecutive content lines become one paragraph; headers and basmalah stay their own blocks. */
function flowBlocks(layout: QcfPageLayout): FlowBlock[] {
  const blocks: FlowBlock[] = []
  for (const line of layout.lines) {
    if (line.kind === 'empty') continue
    if (line.kind !== 'content') {
      blocks.push({ type: 'line', line })
      continue
    }
    const last = blocks[blocks.length - 1]
    if (last?.type === 'text') last.segments.push(...line.segments)
    else blocks.push({ type: 'text', key: line.lineNumber, segments: [...line.segments] })
  }
  return blocks
}

export interface QcfPageProps {
  verses: Verse[]
  pageNumber: number
  immersive?: boolean
  /** Continuous scroll: the page never has to fit one screen's height, so
   *  the glyph size is set from viewport width instead of `100dvh / 15` —
   *  otherwise it inherits the same cramped "must fit one screen" size the
   *  swipe modes need. */
  scrollable?: boolean
  fontReady?: boolean
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
  onAyahSelect?: (verseKey: string) => void
  ayahSelectMode?: boolean
  /** Hifdh test: hide unrevealed ayahs and tap to reveal the next one. */
  hifdhReveal?: {
    startVerseKey: string
    revealedAyahs: Set<string>
    revealableVerseKeys: Set<string>
    nextVerseKey: string | null
    onReveal: (verseKey: string) => void
  }
  /** Hifdh Test's Surprise ayah: per-word visibility on the real page, plus which
   *  verse(s) must stay split word-by-word instead of merged into one run. */
  isSegmentHidden?: (segment: QcfPageSegment, index: number) => boolean
  neverMergeVerseKeys?: Set<string>
  /** Render with this family instead of the page's own (e.g. its tajweed font). */
  fontFamily?: string
}

function QcfPageComponent({
  verses,
  pageNumber,
  immersive = false,
  scrollable = false,
  fontReady = true,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
  onAyahSelect,
  ayahSelectMode = false,
  hifdhReveal,
  isSegmentHidden,
  neverMergeVerseKeys,
  fontFamily,
}: QcfPageProps) {
  const t = useT()
  // Continuous scroll flows the words instead of keeping the 15 printed lines,
  // so the script can be far larger than a full mushaf line allows on a phone.
  const flow = scrollable && !hifdhReveal && !isSegmentHidden
  const layout = useMemo(
    () => buildQcfPageLayout(verses, pageNumber, { neverMergeVerseKeys, wordSegments: flow }),
    [verses, pageNumber, neverMergeVerseKeys, flow]
  )
  const qcfFamily = fontFamily ?? qcfPageFontFamily(pageNumber)
  const pageClass = qcfPageFontClass(pageNumber)
  const startIndex = hifdhReveal
    ? verses.findIndex((verse) => verse.verse_key === hifdhReveal.startVerseKey)
    : -1
  const pageRef = useRef<HTMLDivElement>(null)
  useFitQcfPageLines(pageRef, layout, qcfFamily)
  const blocks = useMemo(() => (flow ? flowBlocks(layout) : []), [flow, layout])

  if (!fontReady) {
    return null
  }

  if (flow) {
    return (
      <div
        ref={pageRef}
        className={cn('mushaf-qcf-page mushaf-qcf-page--flow', pageClass)}
        data-page={pageNumber}
        data-qcf-font={qcfFamily}
        dir="rtl"
        lang="ar"
        aria-label={t('Quran page {pageNumber}', { pageNumber })}
      >
        <div className="mushaf-qcf-flow mushaf-qcf-page-content">
          {blocks.map((block) =>
            block.type === 'line' ? (
              <QcfLine
                key={`line-${block.line.lineNumber}`}
                line={block.line}
                qcfFontFamily={qcfFamily}
                highlightedVerseKey={highlightedVerseKey}
                selectedVerseKey={selectedVerseKey}
                onLineLongPress={onAyahLongPress}
                onAyahSelect={onAyahSelect}
                ayahSelectMode={ayahSelectMode}
              />
            ) : (
              <p
                key={`text-${block.key}`}
                className="mushaf-qcf-flow__text"
                style={{ fontFamily: `"${qcfFamily}", serif` }}
              >
                {block.segments.map((segment, index) => {
                  const next = block.segments[index + 1]
                  // The space sits inside the word's span so a recited ayah's
                  // highlight runs unbroken; a no-break space keeps the ayah
                  // ornament on the same line as the word it closes.
                  const gap = next ? (next.isEnd ? ' ' : ' ') : ''
                  return (
                    <QcfSegment
                      key={`${segment.verseKey}-${index}`}
                      segment={{ ...segment, text: segment.text + gap }}
                      index={index}
                      highlightedVerseKey={highlightedVerseKey}
                      selectedVerseKey={selectedVerseKey}
                      onLongPress={onAyahLongPress}
                      onSelect={onAyahSelect}
                      ayahSelectMode={ayahSelectMode}
                    />
                  )
                })}
              </p>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={pageRef}
      className={cn(
        'mushaf-qcf-page',
        immersive && 'mushaf-qcf-page--immersive',
        scrollable && 'mushaf-qcf-page--scrollable',
        pageClass
      )}
      data-page={pageNumber}
      data-qcf-font={qcfFamily}
      dir="rtl"
      lang="ar"
      aria-label={t('Quran page {pageNumber}', { pageNumber })}
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
              onAyahSelect={onAyahSelect}
              ayahSelectMode={ayahSelectMode}
              revealState={revealState}
              nextVerseKey={hifdhReveal?.nextVerseKey ?? null}
              onReveal={hifdhReveal?.onReveal}
              isSegmentHidden={isSegmentHidden}
            />
          )
        })}
      </div>
    </div>
  )
}

const QcfPage = memo(QcfPageComponent)
export default QcfPage
