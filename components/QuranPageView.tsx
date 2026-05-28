'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { PLAIN_MUSHAF_FONT } from '@/lib/mushaf-render'
import AyahEndMark from '@/components/read/AyahEndMark'
import { getVerseArabicText } from '@/lib/quran-display'
import type { Verse, VerseWord } from '@/types'

interface QuranPageViewProps {
  verses: Verse[]
  chapterNamesById?: Record<number, string>
  startVerseKey: string
  revealableVerseKeys: Set<string>
  revealedAyahs: Set<string>
  onReveal: (verseKey: string) => void
  /** Verse key currently being recited (e.g. "2:255") — highlights on mushaf. */
  highlightedVerseKey?: string | null
  /** Verse key selected via long-press (action menu open). */
  selectedVerseKey?: string | null
  /** Full-screen: 15 lines fit viewport, no scroll. */
  readMode?: boolean
  readOnly?: boolean
  /** Hide grey reveal boxes; unrevealed text stays invisible (for hifdh test). */
  hideRevealBoxes?: boolean
  pageNumber?: number
  onAyahLongPress?: (verseKey: string) => void
}

interface PageWord {
  id: string
  verseKey: string
  text: string
  fallbackText: string
  codeV2?: string
  lineNumber: number
  pageNumber: number
  isEndMark: boolean
}

interface PageLine {
  lineNumber: number
  words: PageWord[]
  chapterNumber?: number
  isSurahHeader?: boolean
  isBasmalah?: boolean
}

const BASMALAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'
const BASMALAH_ORNAMENT = '﷽'

function formatSurahHeaderLabel(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'Surah'
  const hasArabic = /[\u0600-\u06FF]/.test(trimmed)
  if (hasArabic) {
    if (/^سورة\s+/u.test(trimmed)) return trimmed
    return `سورة ${trimmed}`
  }
  if (/^surah\s+/iu.test(trimmed)) return trimmed
  return `Surah ${trimmed}`
}

function surahAyahFromKey(verseKey: string): { surah: number; ayah: number } {
  const [surah, ayah] = verseKey.split(':').map(Number)
  return { surah: surah || 0, ayah: ayah || 0 }
}

function shouldShowBasmalah(verse: Verse): boolean {
  const { surah, ayah } = surahAyahFromKey(verse.verse_key)
  if (ayah !== 1) return false
  if (surah === 1 || surah === 9) return false
  return true
}

function verseKeysForLine(line: PageLine): string[] {
  return [...new Set(line.words.map((w) => w.verseKey))]
}

/** One connected Uthmani string per mushaf line (printed layout, no per-word gaps). */
function buildLineGlyphString(line: PageLine): string {
  const parts: string[] = []
  for (const word of line.words) {
    const piece = word.fallbackText?.trim()
    if (piece) parts.push(piece)
  }
  return parts.join('')
}

function UnicodeMushafVerse({
  verse,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
}: {
  verse: Verse
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
}) {
  const longPress = useLongPress(() => onAyahLongPress?.(verse.verse_key))
  const pageWords = verse.words?.filter((word) => word.char_type_name !== 'end') ?? []
  const text =
    pageWords.length > 0
      ? pageWords
          .map((word) => (word.text_uthmani || word.text_qpc_hafs || '').trim())
          .filter(Boolean)
          .join(' ')
      : getVerseArabicText(verse)
  const endWord = verse.words?.find((word) => word.char_type_name === 'end')
  const hasEndMark = !verse.words?.length || Boolean(endWord)
  const pageNumber = endWord?.v2_page || endWord?.page_number || verse.page_number || 1
  const active = highlightedVerseKey === verse.verse_key
  const selected = selectedVerseKey === verse.verse_key

  if (!text) return null

  return (
    <span
      data-verse-keys={verse.verse_key}
      className={cn(
        'mushaf-unicode-verse',
        active && 'mushaf-line--reciting',
        selected && !active && 'mushaf-line--selected'
      )}
      {...(onAyahLongPress ? longPress.handlers : {})}
    >
      {text}
      {hasEndMark && (
        <AyahEndMark
          verseKey={verse.verse_key}
          pageNumber={pageNumber}
          codeV2={endWord?.code_v2}
          fallbackText={endWord?.text_uthmani || endWord?.text_qpc_hafs || ''}
          onLongPress={onAyahLongPress}
        />
      )}
    </span>
  )
}

function UnicodeMushafPage({
  verses,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
}: {
  verses: Verse[]
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
}) {
  return (
    <div className="mushaf-unicode-page" style={{ fontFamily: PLAIN_MUSHAF_FONT }}>
      {verses.map((verse) => (
        <div key={verse.verse_key} className="mushaf-unicode-verse-wrap">
          {shouldShowBasmalah(verse) && (
            <div className="mushaf-page-line mushaf-page-line--basmalah text-center">
              <span className="basmalah-ornament-inline" aria-label={BASMALAH}>
                {BASMALAH_ORNAMENT}
              </span>
            </div>
          )}
          <UnicodeMushafVerse
            verse={verse}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={selectedVerseKey}
            onAyahLongPress={onAyahLongPress}
          />
        </div>
      ))}
    </div>
  )
}

function MushafWord({
  word,
  className,
  html,
  onAyahLongPress,
}: {
  word: PageWord
  className: string
  html: string
  onAyahLongPress?: (verseKey: string) => void
}) {
  const longPress = useLongPress(() => onAyahLongPress?.(word.verseKey))

  if (!onAyahLongPress) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  }

  return (
    <span
      className={className}
      {...longPress.handlers}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function MushafLineGlyphs({
  line,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
}: {
  line: PageLine
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
}) {
  const verseKeys = verseKeysForLine(line)
  const glyphs = buildLineGlyphString(line)
  const isReciting = verseKeys.some((k) => k === highlightedVerseKey)
  const isSelected = !isReciting && verseKeys.some((k) => k === selectedVerseKey)
  const longPressVerseKey = verseKeys[verseKeys.length - 1] || verseKeys[0]
  const longPress = useLongPress(() => {
    if (longPressVerseKey) onAyahLongPress?.(longPressVerseKey)
  })

  if (!glyphs) return null

  const glyphEl = (
    <span
      className={cn(
        'mushaf-line-glyphs',
        isReciting && 'mushaf-line--reciting',
        isSelected && 'mushaf-line--selected'
      )}
      style={{ fontFamily: PLAIN_MUSHAF_FONT }}
    >
      {glyphs}
    </span>
  )

  if (!onAyahLongPress) return glyphEl

  return (
    <div className="mushaf-line-glyphs-wrap" {...longPress.handlers}>
      {glyphEl}
    </div>
  )
}

function getVerseWords(verse: Verse, useGlyphs: boolean): PageWord[] {
  if (verse.words && verse.words.length > 0) {
    return verse.words
      .filter((word) => {
        if (word.char_type_name === 'end') return true
        return (
          word.text_uthmani.trim().length > 0 ||
          Boolean(word.text_qpc_hafs?.trim()) ||
          Boolean(word.code_v2)
        )
      })
      .map((word: VerseWord) => {
        const isEndMark = word.char_type_name === 'end'
        const pageNumber = word.v2_page || word.page_number || verse.page_number || 1
        const glyphText = word.code_v2 || word.text_qpc_hafs || word.text_uthmani
        const plainText = word.text_qpc_hafs || word.text_uthmani
        return {
          id: String(word.id),
          verseKey: verse.verse_key,
          text: useGlyphs ? glyphText : plainText,
          fallbackText: plainText,
          codeV2: word.code_v2,
          lineNumber: word.line_number || 1,
          pageNumber,
          isEndMark,
        }
      })
  }

  return verse.text_uthmani.split(/\s+/).map((text, index) => ({
    id: `${verse.verse_key}-${index}`,
    verseKey: verse.verse_key,
    text,
    fallbackText: text,
    lineNumber: 1,
    pageNumber: verse.page_number || 1,
    isEndMark: false,
  }))
}

export default function QuranPageView({
  verses,
  chapterNamesById = {},
  startVerseKey,
  revealableVerseKeys,
  revealedAyahs,
  onReveal,
  readMode = false,
  readOnly = false,
  hideRevealBoxes = false,
  pageNumber: pageNumberProp,
  highlightedVerseKey = null,
  selectedVerseKey = null,
  onAyahLongPress,
}: QuranPageViewProps) {
  const startIndex = verses.findIndex((verse) => verse.verse_key === startVerseKey)
  const useLineGlyphs = readMode && readOnly && !hideRevealBoxes

  const { lines, nextVerseKey, pageNumber } = useMemo(() => {
    const lineMap = new Map<number, PageWord[]>()
    const markerMap = new Map<number, Pick<PageLine, 'chapterNumber' | 'isSurahHeader' | 'isBasmalah'>>()
    let detectedPageNumber = 1
    for (const verse of verses) {
      const verseWords = getVerseWords(verse, false)
      const chapterNumber = Number(verse.verse_key.split(':')[0])
      const verseNumber = Number(verse.verse_key.split(':')[1])
      const firstLine = verseWords[0]?.lineNumber

      if (verseNumber === 1 && firstLine) {
        const hasBasmalah = chapterNumber !== 1 && chapterNumber !== 9
        const headerLine = firstLine - (hasBasmalah ? 2 : 1)
        const basmalahLine = firstLine - 1

        markerMap.set(headerLine, { chapterNumber, isSurahHeader: true })

        if (hasBasmalah) {
          markerMap.set(basmalahLine, { chapterNumber, isBasmalah: true })
        }
      }

      for (const word of verseWords) {
        detectedPageNumber = word.pageNumber
        const lineWords = lineMap.get(word.lineNumber) || []
        lineWords.push(word)
        lineMap.set(word.lineNumber, lineWords)
      }
    }

    const extraLineNumbers = Array.from(markerMap.keys())
      .filter((n) => n < 1)
      .sort((a, b) => a - b)

    const sortedLines = [
      ...extraLineNumbers.map((lineNumber) => ({
        lineNumber,
        words: lineMap.get(lineNumber) || [],
        ...markerMap.get(lineNumber),
      })),
      ...Array.from({ length: 15 }, (_, index) => {
        const lineNumber = index + 1
        return {
          lineNumber,
          words: lineMap.get(lineNumber) || [],
          ...markerMap.get(lineNumber),
        }
      }),
    ]

    const firstUnrevealed =
      startIndex >= 0
        ? verses
            .slice(startIndex)
            .find(
              (verse) => revealableVerseKeys.has(verse.verse_key) && !revealedAyahs.has(verse.verse_key)
            )?.verse_key || null
        : null

    return {
      lines: sortedLines,
      nextVerseKey: firstUnrevealed,
      pageNumber: pageNumberProp ?? detectedPageNumber,
    }
  }, [pageNumberProp, revealedAyahs, revealableVerseKeys, startIndex, verses])

  const textClass = readMode ? 'text-[var(--mushaf-read-text)]' : 'text-[var(--mushaf-sheet-text)]'

  const ayahLongPress = readMode && onAyahLongPress ? onAyahLongPress : undefined
  const gridRef = useRef<HTMLDivElement>(null)
  const focusKey = highlightedVerseKey || selectedVerseKey

  useEffect(() => {
    if (!focusKey || !readMode) return
    const root = gridRef.current
    if (!root) return
    const line = root.querySelector(`[data-verse-keys~="${focusKey}"]`)
    line?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusKey, readMode])

  if (startIndex === -1) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-red-500">
        <p>Starting verse not found on this page.</p>
      </div>
    )
  }

  if (readOnly && !readMode) {
    return (
      <div
        className="mx-auto w-full max-w-[980px] px-0 py-2 sm:px-2"
        dir="rtl"
        lang="ar"
        aria-label="Quran page"
      >
        <div ref={gridRef} className="mushaf-unicode-page-wrap">
          <UnicodeMushafPage
            verses={verses}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={selectedVerseKey}
            onAyahLongPress={ayahLongPress}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn('w-full', readMode ? 'relative h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
      dir="rtl"
      lang="ar"
      aria-label="Quran page"
    >
      <div
        ref={gridRef}
        className={cn(
          readMode
            ? 'mushaf-fit-grid h-full'
            : cn(
                'mushaf-page-sheet flex flex-col rounded-lg p-4',
                'min-h-[calc(100vh-12rem)] justify-between sm:min-h-[760px]'
              )
        )}
      >
        {lines.map((line) => {
          const lineVerseKeys = verseKeysForLine(line).join(' ')
          const lineClassName = cn(
            readMode
              ? cn(
                  'mushaf-fit-line',
                  line.isSurahHeader && 'mushaf-fit-line--header surah-header',
                  line.isBasmalah && 'mushaf-fit-line--basmalah basmalah-ornament-inline'
                )
              : cn(
                  'mushaf-page-line flex flex-row flex-wrap items-center justify-center gap-x-[0.06em]',
                  line.isSurahHeader && 'mushaf-page-line--header surah-header',
                  line.isBasmalah && 'mushaf-page-line--basmalah basmalah-ornament-inline'
                )
          )
          const lineStyle = {
            fontFamily: line.isSurahHeader
              ? 'SurahNameV2'
              : PLAIN_MUSHAF_FONT,
          }

          return (
          <div
            key={line.lineNumber}
            data-verse-keys={lineVerseKeys}
            className={lineClassName}
            style={lineStyle}
          >
            {line.isSurahHeader && line.chapterNumber ? (
              <span className={cn('surah-header', textClass)}>
                {formatSurahHeaderLabel(
                  chapterNamesById[line.chapterNumber] || String(line.chapterNumber)
                )}
              </span>
            ) : line.isBasmalah ? (
              <div aria-label={BASMALAH}>
                <span className="basmalah-ornament-inline" aria-hidden="true">
                  {BASMALAH_ORNAMENT}
                </span>
              </div>
            ) : useLineGlyphs ? (
              <MushafLineGlyphs
                line={line}
                highlightedVerseKey={highlightedVerseKey}
                selectedVerseKey={selectedVerseKey}
                onAyahLongPress={ayahLongPress}
              />
            ) : (
              line.words.map((word) => {
                const isRevealed = revealedAyahs.has(word.verseKey)
                const isNext = word.verseKey === nextVerseKey
                const showText = isRevealed
                const isReciting = highlightedVerseKey === word.verseKey
                const isSelected = selectedVerseKey === word.verseKey

                const wordClass = cn(
                  'mushaf-word inline-block border-0 bg-transparent p-0',
                  textClass,
                  isReciting && 'mushaf-word--reciting',
                  isSelected && !isReciting && 'mushaf-word--selected',
                  !showText && 'mushaf-word-hidden select-none !text-transparent'
                )

                const wordHtml = word.fallbackText

                if (word.isEndMark) {
                  if (!showText) {
                    return (
                      <span
                        key={word.id}
                        className="mx-0.5 inline-block h-[1.1em] w-[0.45em] align-middle opacity-0"
                        aria-hidden
                      />
                    )
                  }
                  return (
                    <AyahEndMark
                      key={word.id}
                      verseKey={word.verseKey}
                      pageNumber={word.pageNumber}
                      codeV2={word.codeV2}
                      fallbackText={word.fallbackText}
                      glyphFontReady={false}
                      className={cn(
                        isReciting && 'mushaf-word--reciting',
                        isSelected && !isReciting && 'mushaf-word--selected'
                      )}
                      onLongPress={ayahLongPress}
                    />
                  )
                }

                if (readOnly || !isNext) {
                  return (
                    <MushafWord
                      key={word.id}
                      word={word}
                      className={wordClass}
                      html={wordHtml}
                      onAyahLongPress={ayahLongPress}
                    />
                  )
                }

                return (
                  <button
                    key={word.id}
                    type="button"
                    onClick={() => onReveal(word.verseKey)}
                    className={cn(
                      wordClass,
                      'appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--home-sage-deep)]/50',
                      !showText &&
                        (hideRevealBoxes
                          ? 'inline-block min-w-[0.2em] align-baseline'
                          : 'min-h-[1.4em] min-w-[2.5rem] rounded bg-stone-200/90 ring-1 ring-teal-600/35 dark:bg-stone-700/60 dark:ring-teal-400/40')
                    )}
                    aria-label={`Reveal verse ${word.verseKey}`}
                    dangerouslySetInnerHTML={{ __html: wordHtml }}
                  />
                )
              })
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}
