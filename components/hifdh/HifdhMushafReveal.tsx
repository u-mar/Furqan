'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import QcfPage from '@/components/mushaf/QcfPage'
import { cn } from '@/lib/cn'
import { useQcfFont } from '@/hooks/useQcfFont'
import { getMushafPage } from '@/lib/quran'
import {
  pageHasQcfData,
  qcfPageFontFamily,
  qcfPageSampleGlyphs,
  versePageNumber,
  type QcfPageSegment,
} from '@/lib/qcf-page'
import type { Verse, VerseWord } from '@/types'

/** The local offline mushaf-page store can list the same verse (and the same
 *  word within it) more than once; harmless once merged into one run, but it
 *  doubles visible words once each word is kept separate for per-word reveal. */
function dedupeVerses(verses: Verse[]): Verse[] {
  const seenVerses = new Set<string>()
  const result: Verse[] = []
  for (const verse of verses) {
    if (seenVerses.has(verse.verse_key)) continue
    seenVerses.add(verse.verse_key)

    if (!verse.words?.length) {
      result.push(verse)
      continue
    }
    const seenWords = new Set<number>()
    const words: VerseWord[] = []
    for (const word of verse.words) {
      if (seenWords.has(word.position)) continue
      seenWords.add(word.position)
      words.push(word)
    }
    result.push(words.length === verse.words.length ? verse : { ...verse, words })
  }
  return result
}

interface ResolvedPage {
  pageNumber: number
  verses: Verse[]
}

/**
 * The target ayah's real printed mushaf page — every other ayah on it stays
 * blank (its shaped word-width kept, so the page's real line breaks and ayah
 * markers show, just like the printed page), except the anchor ayah (shown
 * in full, in its own printed spot) and the target ayah, whose words reveal
 * one at a time as `revealedWordCount` grows.
 */
export default function HifdhMushafReveal({
  anchor,
  target,
  revealedWordCount,
  fullyRevealed,
  onWordCount,
  className,
}: {
  /** The ayah shown in full, right on the page, for the target to continue from. */
  anchor: Verse
  target: Verse
  revealedWordCount: number
  fullyRevealed: boolean
  /** Reports the target ayah's real QCF word count once its page loads — the
   *  hint buttons cap reveals against this, not a plain-text word split, since
   *  the two can disagree on how many "words" an ayah has. */
  onWordCount?: (count: number) => void
  /** Sizing/scroll — the caller owns the screen (full immersive reader, same as
   *  /read), this component only owns the page's own visuals and font family. */
  className?: string
}) {
  const guessedPageNumber = versePageNumber(target)
  const [resolved, setResolved] = useState<ResolvedPage | null>(null)

  useEffect(() => {
    let cancelled = false
    setResolved(null)
    if (guessedPageNumber < 1) return

    const tryPage = async (page: number): Promise<Verse[] | null> => {
      try {
        const verses = dedupeVerses(await getMushafPage(page))
        return verses.some((v) => v.verse_key === target.verse_key) ? verses : null
      } catch {
        return null
      }
    }

    void (async () => {
      // A verse's own `page_number` can land a page off from where the local
      // mushaf store actually splits it — try that page, then its neighbours.
      for (const page of [guessedPageNumber, guessedPageNumber + 1, guessedPageNumber - 1]) {
        if (page < 1) continue
        const verses = await tryPage(page)
        if (cancelled) return
        if (verses) {
          setResolved({ pageNumber: page, verses })
          return
        }
      }
      // None of them actually contained the verse — show the guessed page
      // anyway so something renders, rather than an indefinite spinner.
      try {
        const fallback = dedupeVerses(await getMushafPage(guessedPageNumber))
        if (!cancelled) setResolved({ pageNumber: guessedPageNumber, verses: fallback })
      } catch {
        /* leave resolved null; the loading view stays up */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [guessedPageNumber, target.verse_key])

  const pageVerses = resolved?.verses ?? null
  const pageNumber = resolved?.pageNumber ?? guessedPageNumber

  // The target verse's own word positions, in reading order — the stable
  // ordering that `revealedWordCount` counts against (independent of how the
  // QCF layout below happens to group or order its segments).
  const wordPositions = useMemo(() => {
    const verse = pageVerses?.find((v) => v.verse_key === target.verse_key)
    return (
      verse?.words
        ?.filter((w) => w.char_type_name === 'word' && w.code_v2?.trim())
        .map((w) => w.position)
        .sort((a, b) => a - b) ?? []
    )
  }, [pageVerses, target.verse_key])

  useEffect(() => {
    onWordCount?.(wordPositions.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordPositions])

  const revealedPositions = useMemo(
    () => new Set(wordPositions.slice(0, revealedWordCount)),
    [wordPositions, revealedWordCount]
  )

  const neverMergeVerseKeys = useMemo(() => new Set([target.verse_key]), [target.verse_key])

  const hasQcfData = Boolean(pageVerses && pageHasQcfData(pageVerses))
  const qcfSample = pageVerses && hasQcfData ? qcfPageSampleGlyphs(pageVerses, pageNumber) : ''
  const qcfFont = useQcfFont(pageNumber, hasQcfData && pageNumber > 0, qcfSample)
  const containerRef = useRef<HTMLDivElement>(null)

  // The target ayah can land anywhere on its printed page — often below the
  // fold in this card's shorter height — so bring it into view once it
  // renders. Its own words are hidden (visibility:hidden) at this point, and
  // `scrollIntoView` silently no-ops on a hidden element, so this scrolls to
  // its always-visible ayah-end marker instead.
  useEffect(() => {
    if (!qcfFont.ready) return
    const timer = window.setTimeout(() => {
      const end = containerRef.current?.querySelector(
        `[data-verse-key="${target.verse_key}"].mushaf-qcf-segment--end`
      )
      end?.scrollIntoView({ block: 'center' })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [qcfFont.ready, target.verse_key])

  if (!pageVerses || !hasQcfData || !qcfFont.ready) {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-current opacity-40" />
      </div>
    )
  }

  const qcfFamily = qcfPageFontFamily(pageNumber)
  const isSegmentHidden = (segment: QcfPageSegment): boolean => {
    if (segment.isEnd) return false
    if (segment.verseKey === anchor.verse_key) return false
    if (segment.verseKey !== target.verse_key) return true
    if (fullyRevealed) return false
    return segment.position === undefined || !revealedPositions.has(segment.position)
  }

  return (
    <div
      ref={containerRef}
      className={cn('mushaf-root', className)}
      style={{ fontFamily: qcfFamily, ['--mushaf-qcf-font-family' as string]: qcfFamily }}
      data-qcf-font={qcfFamily}
    >
      <QcfPage
        verses={pageVerses}
        pageNumber={pageNumber}
        immersive
        fontReady={qcfFont.ready}
        neverMergeVerseKeys={neverMergeVerseKeys}
        isSegmentHidden={isSegmentHidden}
      />
    </div>
  )
}
