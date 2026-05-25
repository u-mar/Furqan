'use client'

import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { useLongPress } from '@/hooks/useLongPress'
import { useQcfFont } from '@/hooks/useQcfFont'
import { qcfFontFamily } from '@/lib/mushaf-fonts'
import { PLAIN_MUSHAF_FONT, shouldAttemptQcfFonts, wantsUthmaniGlyphs } from '@/lib/mushaf-render'
import { normalizeUthmaniPage, type NormalizedUthmaniVerse } from '@/lib/quran-normalizer'
import { getVerseArabicText } from '@/lib/quran-display'
import type { MushafStyle } from '@/lib/app-settings'
import type { Verse, VerseWord } from '@/types'

interface QuranPageViewProps {
  verses: Verse[]
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
  mushafStyle?: MushafStyle
  pageNumber?: number
  onAyahLongPress?: (verseKey: string) => void
}

interface PageWord {
  id: string
  verseKey: string
  text: string
  fallbackText: string
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

function verseKeysForLine(line: PageLine): string[] {
  return [...new Set(line.words.map((w) => w.verseKey))]
}

function QcfMushafPage({
  verses,
  className,
  style,
  highlightedVerseKey,
  selectedVerseKey,
  onAyahLongPress,
}: {
  verses: NormalizedUthmaniVerse[]
  className?: string
  style: CSSProperties
  highlightedVerseKey?: string | null
  selectedVerseKey?: string | null
  onAyahLongPress?: (verseKey: string) => void
}) {
  const verseKeys = verses.map((verse) => verse.verseKey)
  const preferredVerseKey =
    verseKeys.find((key) => key === selectedVerseKey || key === highlightedVerseKey) || verseKeys[0]
  const longPress = useLongPress(() => {
    if (preferredVerseKey) onAyahLongPress?.(preferredVerseKey)
  })

  return (
    <div
      data-verse-keys={verseKeys.join(' ')}
      data-qcf-font-family={String(style.fontFamily ?? '')}
      className={cn(
        'mushaf-qcf-page-content',
        highlightedVerseKey && verseKeys.includes(highlightedVerseKey) && 'mushaf-line--reciting',
        selectedVerseKey && verseKeys.includes(selectedVerseKey) && 'mushaf-line--selected',
        className
      )}
      style={style}
      {...(onAyahLongPress ? longPress.handlers : {})}
    >
      {verses.map((verse) => (
        <span
          key={verse.id}
          data-verse-keys={verse.verseKey}
          className={cn(
            'qcf-line',
            highlightedVerseKey === verse.verseKey && 'mushaf-line--reciting',
            selectedVerseKey === verse.verseKey && 'mushaf-line--selected'
          )}
        >
          {verse.text}
        </span>
      ))}
    </div>
  )
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
  const text = getVerseArabicText(verse)
  const active = highlightedVerseKey === verse.verse_key
  const selected = selectedVerseKey === verse.verse_key

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
        <UnicodeMushafVerse
          key={verse.verse_key}
          verse={verse}
          highlightedVerseKey={highlightedVerseKey}
          selectedVerseKey={selectedVerseKey}
          onAyahLongPress={onAyahLongPress}
        />
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
  startVerseKey,
  revealableVerseKeys,
  revealedAyahs,
  onReveal,
  readMode = false,
  readOnly = false,
  mushafStyle = 'indopak',
  pageNumber: pageNumberProp,
  highlightedVerseKey = null,
  selectedVerseKey = null,
  onAyahLongPress,
}: QuranPageViewProps) {
  const startIndex = verses.findIndex((verse) => verse.verse_key === startVerseKey)
  const useGlyphs = wantsUthmaniGlyphs(mushafStyle)
  const tryQcfFonts = shouldAttemptQcfFonts(mushafStyle)
  const useStrictUthmani = readOnly && useGlyphs
  const normalizedUthmaniVerses = useMemo(
    () => (useStrictUthmani ? normalizeUthmaniPage(verses) : []),
    [useStrictUthmani, verses]
  )

  const { lines, nextVerseKey, pageNumber, hasQcfGlyphs } = useMemo(() => {
    if (useStrictUthmani) {
      return {
        lines: [],
        nextVerseKey: null,
        pageNumber: pageNumberProp ?? verses.find((verse) => verse.page_number)?.page_number ?? 1,
        hasQcfGlyphs: verses.some((verse) => Boolean(verse.code_v2?.trim())),
      }
    }

    const lineMap = new Map<number, PageWord[]>()
    const markerMap = new Map<number, Pick<PageLine, 'chapterNumber' | 'isSurahHeader' | 'isBasmalah'>>()
    let detectedPageNumber = 1
    let detectedQcfGlyphs = false

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
        detectedQcfGlyphs = detectedQcfGlyphs || Boolean(verse.words?.some((item) => item.code_v2))
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
      hasQcfGlyphs: detectedQcfGlyphs,
    }
  }, [pageNumberProp, revealedAyahs, revealableVerseKeys, startIndex, useStrictUthmani, verses])

  const qcfFamily = qcfFontFamily(pageNumber)
  const needsQuranFonts =
    tryQcfFonts &&
    (useStrictUthmani
      ? normalizedUthmaniVerses.length > 0
      : hasQcfGlyphs || lines.some((l) => l.isSurahHeader || l.isBasmalah))

  const textClass = readMode ? 'text-[var(--mushaf-read-text)]' : 'text-[var(--mushaf-sheet-text)]'
  const qcfFontReady = useQcfFont(
    pageNumber,
    useStrictUthmani && tryQcfFonts && normalizedUthmaniVerses.length > 0
  )

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

  if (useStrictUthmani && normalizedUthmaniVerses.length === 0) {
    return (
      <div
        className={cn('w-full', readMode ? 'relative h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
        dir="rtl"
        lang="ar"
        aria-label="Uthmani glyph data unavailable"
      >
        <div className="mushaf-qcf-page h-full">
          <div className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-stone-300">
            Uthmani glyph data unavailable.
          </div>
        </div>
      </div>
    )
  }

  if (useStrictUthmani && !tryQcfFonts) {
    return (
      <div
        className={cn('w-full', readMode ? 'relative h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
        dir="rtl"
        lang="ar"
        aria-label="Uthmani font unavailable"
      >
        <div className="mushaf-qcf-page h-full">
          <div className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-stone-300">
            Uthmani font unavailable. Connect to internet or download fonts.
          </div>
        </div>
      </div>
    )
  }

  if (useStrictUthmani && !qcfFontReady) {
    return (
      <div
        className={cn('w-full', readMode ? 'relative h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
        dir="rtl"
        lang="ar"
        aria-label="Loading Uthmani page font"
      >
        <div className="mushaf-qcf-page h-full">
          <div className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-stone-300">
            Loading Uthmani mushaf font…
          </div>
        </div>
      </div>
    )
  }

  if (useStrictUthmani) {
    return (
      <div
        className={cn('w-full', readMode ? 'relative h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
        dir="rtl"
        lang="ar"
        aria-label="Quran page"
      >
        <div ref={gridRef} className="mushaf-qcf-page h-full">
          <QcfMushafPage
            verses={normalizedUthmaniVerses}
            style={{
              fontFamily: qcfFamily,
              letterSpacing: 0,
              wordSpacing: 0,
            }}
            highlightedVerseKey={highlightedVerseKey}
            selectedVerseKey={selectedVerseKey}
            onAyahLongPress={ayahLongPress}
          />
        </div>
      </div>
    )
  }

  if (readOnly) {
    return (
      <div
        className={cn('w-full', readMode ? 'relative h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
        dir="rtl"
        lang="ar"
        aria-label="Quran page"
      >
        <div ref={gridRef} className="mushaf-unicode-page-wrap h-full">
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
      {needsQuranFonts && (
        <style>{`
          .surah-header {
            font-family: 'SurahNameV2';
            line-height: 1;
          }
          .basmalah-ornament-inline {
            font-family: 'SurahNameV2';
            line-height: 1;
          }
        `}</style>
      )}

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
                  'mushaf-fit-line flex-row flex-wrap gap-x-[0.05em]',
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
              <div className={cn('flex w-full items-center justify-center gap-3', textClass)}>
                {!readMode && (
                  <>
                    <span className="h-px flex-1 bg-[var(--mushaf-sheet-border)]" aria-hidden />
                  </>
                )}
                <span>{`surah${String(line.chapterNumber).padStart(3, '0')}`}</span>
                {!readMode && (
                  <span className="h-px flex-1 bg-[var(--mushaf-sheet-border)]" aria-hidden />
                )}
              </div>
            ) : line.isBasmalah ? (
              <div aria-label={BASMALAH}>
                <span aria-hidden="true">{BASMALAH_ORNAMENT}</span>
              </div>
            ) : (
              line.words.map((word) => {
                const isRevealed = revealedAyahs.has(word.verseKey)
                const isNext = word.verseKey === nextVerseKey
                const shouldShowText = isRevealed || word.isEndMark
                const isReciting = highlightedVerseKey === word.verseKey
                const isSelected = selectedVerseKey === word.verseKey

                const wordClass = cn(
                  'mushaf-word inline-block border-0 bg-transparent p-0',
                  textClass,
                  isReciting && 'mushaf-word--reciting',
                  isSelected && !isReciting && 'mushaf-word--selected',
                  !shouldShowText && 'mushaf-word-hidden select-none !text-transparent'
                )

                const wordHtml = word.fallbackText

                if (word.isEndMark) {
                  if (ayahLongPress) {
                    return (
                      <MushafWord
                        key={word.id}
                        word={word}
                        className={cn(
                          'mx-0.5 inline-block opacity-90',
                          isReciting && 'mushaf-word--reciting',
                          isSelected && !isReciting && 'mushaf-word--selected'
                        )}
                        html={wordHtml}
                        onAyahLongPress={ayahLongPress}
                      />
                    )
                  }
                  return (
                    <span
                      key={word.id}
                      className={cn(
                        'mx-0.5 inline-block opacity-90',
                        isReciting && 'mushaf-word--reciting',
                        isSelected && !isReciting && 'mushaf-word--selected'
                      )}
                    >
                      {wordHtml}
                    </span>
                  )
                }

                if (readOnly || !isNext) {
                  return (
                    <MushafWord
                      key={word.id}
                      word={word}
                      className={cn(wordClass, 'arabic-text')}
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
                      'arabic-text',
                      'appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600',
                      !shouldShowText &&
                        'min-h-[1.4em] min-w-[2.5rem] rounded bg-stone-200/90 ring-1 ring-teal-600/35 dark:bg-stone-700/60 dark:ring-teal-400/40'
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
