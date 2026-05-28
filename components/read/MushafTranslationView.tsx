'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import AyahEndMark from '@/components/read/AyahEndMark'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import { getVerseArabicText } from '@/lib/quran-display'
import type { TranslationLanguageId } from '@/lib/translations'
import type { Chapter, Verse } from '@/types'

interface MushafTranslationViewProps {
  verses: Verse[]
  page: number
  chapters: Chapter[]
  translationLanguage: TranslationLanguageId
  highlightedVerseKey?: string | null
  showArabic?: boolean
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

  const displayRows = verses.map((verse) => {
    const endWord = verse.words?.find((word) => word.char_type_name === 'end')
    return {
      verse_key: verse.verse_key,
      text_uthmani: arabicByKey[verse.verse_key] || getVerseArabicText(verse),
      endWord,
      translation: byKey[verse.verse_key]?.translation || '',
    }
  })

  useEffect(() => {
    if (!highlightedVerseKey) return
    const el = ayahRefs.current.get(highlightedVerseKey)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }, [highlightedVerseKey])

  if (loading && rows.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-600 dark:border-stone-600 dark:border-t-teal-500" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-8">
      {displayRows.map((row) => {
        const num = verseNumber(row.verse_key)
        const surah = surahNumber(row.verse_key)
        const isReciting = highlightedVerseKey === row.verse_key
        const showBasmalah = num === 1 && surah !== 1 && surah !== 9

        return (
          <article
            key={row.verse_key}
            ref={(node) => {
              if (node) ayahRefs.current.set(row.verse_key, node)
              else ayahRefs.current.delete(row.verse_key)
            }}
            id={`translation-ayah-${row.verse_key.replace(':', '-')}`}
            className={cn(
              'space-y-4 rounded-2xl px-2 py-2 transition-colors duration-300',
              isReciting && 'mushaf-translation-ayah--reciting'
            )}
          >
            {showBasmalah && (
              <p
                className="mushaf-translation-arabic text-center text-[clamp(1.2rem,4.8vw,1.65rem)] leading-[2.15] text-[var(--mushaf-read-text)]"
                dir="rtl"
                lang="ar"
              >
                ﷽
              </p>
            )}
            {showArabic && (
              <p
                className={cn(
                  'mushaf-translation-arabic text-center text-[clamp(1.2rem,4.8vw,1.65rem)] leading-[2.15] text-[var(--mushaf-read-text)]',
                  isReciting && 'mushaf-translation-arabic--reciting'
                )}
                dir="rtl"
                lang="ar"
              >
                {row.text_uthmani}{' '}
                <AyahEndMark
                  verseKey={row.verse_key}
                  pageNumber={row.endWord?.v2_page || row.endWord?.page_number || page}
                  codeV2={row.endWord?.code_v2}
                  fallbackText={row.endWord?.text_uthmani || row.endWord?.text_qpc_hafs || ''}
                  glyphFontReady={false}
                />
              </p>
            )}

            <div
              className={cn(
                'rounded-2xl px-4 py-3.5',
                isReciting ? 'bg-teal-500/15 ring-1 ring-teal-500/30' : 'bg-stone-100 dark:bg-[#1a1a1a]'
              )}
            >
              <p className="text-left text-[15px] leading-relaxed text-[var(--mushaf-read-text)]">
                <span className="text-[var(--mushaf-read-meta)]">({num})</span>{' '}
                {row.translation || (loading ? 'Loading…' : 'Translation unavailable.')}
              </p>
            </div>
          </article>
        )
      })}
    </div>
  )
}


