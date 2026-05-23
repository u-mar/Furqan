'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import type { MushafStyle } from '@/lib/app-settings'
import type { Verse, VerseWord } from '@/types'

interface QuranPageViewProps {
  verses: Verse[]
  startVerseKey: string
  revealableVerseKeys: Set<string>
  revealedAyahs: Set<string>
  onReveal: (verseKey: string) => void
  /** Full-screen: 15 lines fit viewport, no scroll. */
  readMode?: boolean
  readOnly?: boolean
  mushafStyle?: MushafStyle
  pageNumber?: number
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

function getVerseWords(verse: Verse, useGlyphs: boolean): PageWord[] {
  if (verse.words && verse.words.length > 0) {
    return verse.words
      .filter((word) => word.text_uthmani.trim().length > 0)
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
  mushafStyle = 'uthmani-glyphs',
  pageNumber: pageNumberProp,
}: QuranPageViewProps) {
  const startIndex = verses.findIndex((verse) => verse.verse_key === startVerseKey)
  const useGlyphs = mushafStyle === 'uthmani-glyphs'

  const { lines, nextVerseKey, pageNumber, hasQcfGlyphs } = useMemo(() => {
    const lineMap = new Map<number, PageWord[]>()
    const markerMap = new Map<number, Pick<PageLine, 'chapterNumber' | 'isSurahHeader' | 'isBasmalah'>>()
    let detectedPageNumber = 1
    let detectedQcfGlyphs = false

    for (const verse of verses) {
      const verseWords = getVerseWords(verse, useGlyphs)
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
        detectedQcfGlyphs =
          useGlyphs && (detectedQcfGlyphs || Boolean(verse.words?.some((item) => item.code_v2)))
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
  }, [pageNumberProp, revealedAyahs, revealableVerseKeys, startIndex, verses, useGlyphs])

  if (startIndex === -1) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-red-500">
        <p>Starting verse not found on this page.</p>
      </div>
    )
  }

  const qcfFontFamily = `QCFPage${pageNumber}V2`
  const needsQuranFonts =
    useGlyphs && (hasQcfGlyphs || lines.some((l) => l.isSurahHeader || l.isBasmalah))

  const textClass = readMode ? 'text-[var(--mushaf-read-text)]' : 'text-[var(--mushaf-sheet-text)]'

  return (
    <div
      className={cn('w-full', readMode ? 'h-full' : 'mx-auto max-w-[980px] px-0 py-2 sm:px-2')}
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
            line-height: 1;
          }
          .basmalah-ornament-inline {
            font-family: 'SurahNameV2';
            line-height: 1;
          }
        `}</style>
      )}

      <div
        className={cn(
          readMode
            ? 'mushaf-fit-grid h-full'
            : cn(
                'mushaf-page-sheet flex flex-col rounded-lg p-4',
                'min-h-[calc(100vh-12rem)] justify-between sm:min-h-[760px]'
              )
        )}
      >
        {lines.map((line) => (
          <div
            key={line.lineNumber}
            className={cn(
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

                const wordClass = cn(
                  'mushaf-word inline-block border-0 bg-transparent p-0',
                  textClass,
                  !shouldShowText && 'mushaf-word-hidden select-none !text-transparent'
                )

                if (word.isEndMark) {
                  return (
                    <span key={word.id} className="mx-0.5 inline-block opacity-90">
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
                      'appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600'
                    )}
                    aria-label={`Reveal verse ${word.verseKey}`}
                    dangerouslySetInnerHTML={{
                      __html: hasQcfGlyphs ? word.text : word.fallbackText,
                    }}
                  />
                )
              })
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
