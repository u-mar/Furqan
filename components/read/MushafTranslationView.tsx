'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import type { Chapter, Verse } from '@/types'

interface MushafTranslationViewProps {
  verses: Verse[]
  page: number
  chapters: Chapter[]
  highlightedVerseKey?: string | null
}

function verseNumber(verseKey: string): number {
  return Number(verseKey.split(':')[1] || 0)
}

function surahNumber(verseKey: string): number {
  return Number(verseKey.split(':')[0] || 1)
}

export default function MushafTranslationView({
  verses,
  page,
  chapters,
  highlightedVerseKey = null,
}: MushafTranslationViewProps) {
  const verseKeys = verses.map((v) => v.verse_key)
  const arabicByKey = Object.fromEntries(verses.map((v) => [v.verse_key, v.text_uthmani]))
  const { rows, loading } = usePageTranslations(page, true, verseKeys, arabicByKey)
  const ayahRefs = useRef<Map<string, HTMLElement>>(new Map())

  const displayRows =
    rows.length > 0
      ? rows
      : verses.map((v) => ({
          verse_key: v.verse_key,
          text_uthmani: v.text_uthmani,
          translation: '',
        }))

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
      {displayRows.map((row, index) => {
        const num = verseNumber(row.verse_key)
        const prevSurah = index > 0 ? surahNumber(displayRows[index - 1].verse_key) : 0
        const curSurah = surahNumber(row.verse_key)
        const showHeader = curSurah !== prevSurah
        const surahTitle =
          chapters.find((c) => c.id === curSurah)?.englishName || `Surah ${curSurah}`
        const isReciting = highlightedVerseKey === row.verse_key

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
            {showHeader && (
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-[var(--mushaf-read-meta)]">{surahTitle}</span>
              </div>
            )}
            <p
              className={cn(
                'text-center text-[clamp(1.15rem,4.5vw,1.5rem)] leading-[2.1] text-[var(--mushaf-read-text)]',
                isReciting && 'mushaf-translation-arabic--reciting'
              )}
              dir="rtl"
              lang="ar"
            >
              {row.text_uthmani}
              <span
                className={cn(
                  'mx-1 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border px-1 text-[0.65rem] font-medium',
                  isReciting
                    ? 'border-teal-500/60 text-teal-400'
                    : 'border-[var(--mushaf-read-meta)]/40 text-[var(--mushaf-read-meta)]'
                )}
                aria-label={`Verse ${num}`}
              >
                {num}
              </span>
            </p>

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


