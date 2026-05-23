'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { Verse, VerseWord } from '@/types'

interface QuranPageViewProps {
  verses: Verse[]
  startVerseKey: string
  revealableVerseKeys: Set<string>
  revealedAyahs: Set<string>
  onReveal: (verseKey: string) => void
  /** Dark mushaf reader (full-screen read mode). */
  darkMushaf?: boolean
  /** When true, words are not clickable (read-only). */
  readOnly?: boolean
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

function getVerseWords(verse: Verse): PageWord[] {
  if (verse.words && verse.words.length > 0) {
    return verse.words
      .filter((word) => word.text_uthmani.trim().length > 0)
      .map((word: VerseWord) => {
        const isEndMark = word.char_type_name === 'end'
        const pageNumber = word.v2_page || word.page_number || verse.page_number || 1
        return {
          id: String(word.id),
          verseKey: verse.verse_key,
          text: word.code_v2 || word.text_qpc_hafs || word.text_uthmani,
          fallbackText: word.text_qpc_hafs || word.text_uthmani,
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
  darkMushaf = false,
  readOnly = false,
}: QuranPageViewProps) {
  const startIndex = verses.findIndex((verse) => verse.verse_key === startVerseKey)

  const { lines, nextVerseKey, pageNumber, hasQcfGlyphs } = useMemo(() => {
    const lineMap = new Map<number, PageWord[]>()
    const markerMap = new Map<number, Pick<PageLine, 'chapterNumber' | 'isSurahHeader' | 'isBasmalah'>>()
    let detectedPageNumber = 1
    let detectedQcfGlyphs = false

    for (const verse of verses) {
      const verseWords = getVerseWords(verse)
      const chapterNumber = Number(verse.verse_key.split(':')[0])
      const verseNumber = Number(verse.verse_key.split(':')[1])
      const firstLine = verseWords[0]?.lineNumber

      if (verseNumber === 1 && firstLine) {
        const hasBasmalah = chapterNumber !== 1 && chapterNumber !== 9
        const headerLine = firstLine - (hasBasmalah ? 2 : 1)
        const basmalahLine = firstLine - 1

        markerMap.set(headerLine, {
          chapterNumber,
          isSurahHeader: true,
        })

        if (hasBasmalah) {
          markerMap.set(basmalahLine, {
            chapterNumber,
            isBasmalah: true,
          })
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
      pageNumber: detectedPageNumber,
      hasQcfGlyphs: detectedQcfGlyphs,
    }
  }, [revealedAyahs, revealableVerseKeys, startIndex, verses])

  if (startIndex === -1) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-red-300">
        <p>Starting verse not found on this page.</p>
      </div>
    )
  }

  const qcfFontFamily = `QCFPage${pageNumber}V2`

  const needsQuranFonts = hasQcfGlyphs || lines.some((l) => l.isSurahHeader || l.isBasmalah)

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[980px] px-0 sm:px-2',
        readOnly && darkMushaf ? 'py-0' : 'py-2',
        darkMushaf && 'text-white'
      )}
      dir="rtl"
      lang="ar"
      aria-label="Quran page"
    >
      {needsQuranFonts && (
        <style>{`
          @font-face {
            font-family: '${qcfFontFamily}';
            src: url('https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${pageNumber}.woff2') format('woff2');
            font-display: block;
          }
          @font-face {
            font-family: 'SurahNameV2';
            src: url('https://static-cdn.tarteel.ai/qul/fonts/surah-names/v2/surah-name-v2.ttf') format('truetype');
            font-display: swap;
          }
          .surah-header {
            font-family: 'SurahNameV2';
            font-size: clamp(28px, 5vw, 44px) !important;
            line-height: 1;
          }
          .basmalah-ornament {
            font-family: 'SurahNameV2';
            font-size: clamp(24px, 4vw, 36px) !important;
            line-height: 1;
            opacity: 0.9;
          }
        `}</style>
      )}

      <div
        className={cn(
          'flex flex-col',
          readOnly && darkMushaf
            ? 'justify-start gap-0.5 pt-4 pb-6'
            : 'min-h-[calc(100vh-12rem)] justify-between sm:min-h-[760px]'
        )}
      >
        {lines.map((line) => (
          <div
            key={line.lineNumber}
            className={cn(
              'flex min-h-[2.05em] flex-row items-center justify-center gap-x-[0.04em] text-[clamp(22px,4vw,38px)] leading-[1.22]',
              readOnly && darkMushaf && 'min-h-[2.15em]',
              line.isSurahHeader && 'min-h-[1.45em] text-[clamp(28px,5vw,44px)]',
              line.isBasmalah && 'min-h-[1.45em] text-[clamp(24px,4vw,36px)]',
              readOnly && darkMushaf && line.isSurahHeader && 'mt-2',
              readOnly && darkMushaf && line.isBasmalah && 'mt-1'
            )}
            style={{
              fontFamily: line.isSurahHeader
                ? 'SurahNameV2'
                : hasQcfGlyphs
                  ? qcfFontFamily
                  : "'UthmanicHafs', 'Traditional Arabic', serif",
            }}
          >
            {line.isSurahHeader && line.chapterNumber ? (
              <div
                className={cn(
                  'flex w-full items-center justify-center gap-3 surah-header',
                  darkMushaf ? 'text-white' : 'text-stone-950 dark:text-stone-100'
                )}
              >
                <span
                  className={cn(
                    'h-px flex-1',
                    darkMushaf ? 'bg-stone-700' : 'bg-stone-200 dark:bg-stone-800'
                  )}
                  aria-hidden
                />
                <span>{`surah${String(line.chapterNumber).padStart(3, '0')}`}</span>
                <span
                  className={cn(
                    'h-px flex-1',
                    darkMushaf ? 'bg-stone-700' : 'bg-stone-200 dark:bg-stone-800'
                  )}
                  aria-hidden
                />
              </div>
            ) : line.isBasmalah ? (
              <div className="basmalah-ornament" aria-label={BASMALAH}>
                <span aria-hidden="true">{BASMALAH_ORNAMENT}</span>
              </div>
) : (
              line.words.map((word) => {
              const isRevealed = revealedAyahs.has(word.verseKey)
              const isNext = word.verseKey === nextVerseKey
              const shouldShowText = isRevealed || word.isEndMark

              const wordClass = cn(
                'mushaf-word inline-block border-0 bg-transparent p-0',
                darkMushaf ? 'text-white' : 'text-stone-950 dark:text-stone-100',
                !shouldShowText && 'mushaf-word-hidden select-none !text-transparent'
              )

              if (word.isEndMark) {
                return (
                  <span key={word.id} className="mx-0.5 inline-block">
                    {word.text}
                  </span>
                )
              }

              if (readOnly || !isNext) {
                return (
                  <span
                    key={word.id}
                    className={wordClass}
                    dangerouslySetInnerHTML={{
                      __html: hasQcfGlyphs ? word.text : word.fallbackText,
                    }}
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
                    'appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 dark:focus-visible:ring-teal-300'
                  )}
                  aria-label={`Reveal verse ${word.verseKey}`}
                  title={`Reveal ${word.verseKey}`}
                  dangerouslySetInnerHTML={{
                    __html: hasQcfGlyphs ? word.text : word.fallbackText,
                  }}
                />
              )
            }))}
          </div>
        ))}
      </div>
    </div>
  )
}
