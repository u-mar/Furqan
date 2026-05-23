'use client'

import { cn } from '@/lib/cn'
import { usePageTranslations } from '@/hooks/usePageTranslations'
import type { Chapter, Verse } from '@/types'

interface MushafTranslationViewProps {
  verses: Verse[]
  page: number
  chapters: Chapter[]
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
}: MushafTranslationViewProps) {
  const verseKeys = verses.map((v) => v.verse_key)
  const arabicByKey = Object.fromEntries(verses.map((v) => [v.verse_key, v.text_uthmani]))
  const { rows, loading } = usePageTranslations(page, true, verseKeys, arabicByKey)

  const displayRows =
    rows.length > 0
      ? rows
      : verses.map((v) => ({
          verse_key: v.verse_key,
          text_uthmani: v.text_uthmani,
          translation: '',
        }))

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

        return (
          <article key={row.verse_key} className="space-y-4">
            {showHeader && (
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-[var(--mushaf-read-meta)]">{surahTitle}</span>
              </div>
            )}
            <p
              className="text-center text-[clamp(1.15rem,4.5vw,1.5rem)] leading-[2.1] text-[var(--mushaf-read-text)]"
              dir="rtl"
              lang="ar"
            >
              {row.text_uthmani}
              <span
                className="mx-1 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border border-[var(--mushaf-read-meta)]/40 px-1 text-[0.65rem] font-medium text-[var(--mushaf-read-meta)]"
                aria-label={`Verse ${num}`}
              >
                {num}
              </span>
            </p>

            <div
              className={cn(
                'rounded-2xl px-4 py-3.5',
                'bg-stone-100 dark:bg-[#1a1a1a]'
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
