'use client'

import { useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/cn'
import { useQcfFont } from '@/hooks/useQcfFont'
import { BASMALAH_ORNAMENT } from '@/lib/mushaf-basmalah'
import AyahEndMark from '@/components/read/AyahEndMark'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import { surahHasOpeningBasmalah } from '@/lib/mushaf-basmalah'
import { getVerseArabicText } from '@/lib/quran-display'
import {
  getVerseQcfGlyphs,
  pageHasQcfData,
  qcfPageFontFamily,
  qcfPageSampleGlyphs,
} from '@/lib/qcf-page'
import type { TranslationLanguageId } from '@/lib/translations'
import type { Chapter, Verse } from '@/types'

interface MushafTranslationViewProps {
  verses: Verse[]
  page: number
  chapters: Chapter[]
  translationLanguage: TranslationLanguageId
  highlightedVerseKey?: string | null
  showArabic?: boolean
  suppressHighlightScroll?: boolean
}

function verseNumber(verseKey: string): number {
  return Number(verseKey.split(':')[1] || 0)
}

function surahNumber(verseKey: string): number {
  return Number(verseKey.split(':')[0] || 0)
}

export default function MushafTranslationView({
  verses,
  page,
  translationLanguage,
  highlightedVerseKey = null,
  showArabic = true,
  suppressHighlightScroll = false,
}: MushafTranslationViewProps) {
  const verseKeys = verses.map((v) => v.verse_key)
  const arabicByKey = Object.fromEntries(
    verses.map((v) => [v.verse_key, getVerseArabicText(v, { omitEndMark: true })])
  )
  const { rows, byKey, loading } = usePageTranslations(
    page,
    true,
    verseKeys,
    arabicByKey,
    translationLanguage
  )
  const ayahRefs = useRef<Map<string, HTMLElement>>(new Map())

  const hasQcf = pageHasQcfData(verses)
  const qcfSample = useMemo(
    () => (hasQcf && page > 0 ? qcfPageSampleGlyphs(verses, page) : ''),
    [hasQcf, page, verses]
  )
  const qcfFamily = qcfPageFontFamily(page)
  const { ready: qcfFontReady } = useQcfFont(page, hasQcf, qcfSample)
  const useQcfGlyphs = hasQcf && qcfFontReady

  const displayRows = verses.map((verse) => {
    const endWord = verse.words?.find((word) => word.char_type_name === 'end')
    const qcfGlyphs = getVerseQcfGlyphs(verse, page)
    return {
      verse_key: verse.verse_key,
      text_uthmani: arabicByKey[verse.verse_key] || getVerseArabicText(verse),
      qcfGlyphs,
      endWord,
      translation: byKey[verse.verse_key]?.translation || '',
    }
  })

  useEffect(() => {
    if (!highlightedVerseKey || suppressHighlightScroll) return
    const el = ayahRefs.current.get(highlightedVerseKey)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [highlightedVerseKey, suppressHighlightScroll])

  if (loading && rows.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-600 dark:border-stone-600 dark:border-t-teal-500" />
      </div>
    )
  }

  return (
    <div
      className={cn('mushaf-root space-y-5 pb-8', useQcfGlyphs && 'mushaf-translation-qcf')}
      style={{ '--mushaf-qcf-font-family': qcfFamily } as React.CSSProperties}
    >
      {displayRows.map((row) => {
        const num = verseNumber(row.verse_key)
        const surah = surahNumber(row.verse_key)
        const isReciting = highlightedVerseKey === row.verse_key
        const showBasmalah = num === 1 && surahHasOpeningBasmalah(surah)
        const showGlyphAyah = useQcfGlyphs && Boolean(row.qcfGlyphs)

        return (
          <article
            key={row.verse_key}
            ref={(node) => {
              if (node) ayahRefs.current.set(row.verse_key, node)
              else ayahRefs.current.delete(row.verse_key)
            }}
            id={`translation-ayah-${row.verse_key.replace(':', '-')}`}
            className="px-1"
          >
            <div
              className={cn(
                'mushaf-translation-body rounded-2xl px-4 py-4 transition-colors duration-300',
                isReciting && 'mushaf-translation-body--reciting'
              )}
            >
              {showBasmalah && (
                <p
                  className="mushaf-translation-basmalah mb-3 text-center"
                  dir="rtl"
                  lang="ar"
                  aria-label="Basmalah"
                >
                  {BASMALAH_ORNAMENT}
                </p>
              )}

              {showArabic && (
                <p
                  className={cn(
                    'mushaf-translation-arabic text-center',
                    showGlyphAyah && 'mushaf-translation-arabic--qcf',
                    isReciting && 'mushaf-translation-arabic--reciting'
                  )}
                  dir="rtl"
                  lang="ar"
                >
                  {showGlyphAyah ? (
                    row.qcfGlyphs
                  ) : (
                    <>
                      {row.text_uthmani}{' '}
                      <AyahEndMark
                        verseKey={row.verse_key}
                        pageNumber={row.endWord?.v2_page || row.endWord?.page_number || page}
                        codeV2={row.endWord?.code_v2}
                        fallbackText={row.endWord?.text_uthmani || row.endWord?.text_qpc_hafs || ''}
                        glyphFontReady={qcfFontReady}
                      />
                    </>
                  )}
                </p>
              )}

              <p className="mushaf-translation-text">
                <span className="mushaf-translation-ayah-num">({num})</span>{' '}
                {row.translation || (loading ? 'Loading…' : 'Translation unavailable.')}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
