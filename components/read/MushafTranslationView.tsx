'use client'

import { cn } from '@/lib/cn'
import { juzForChapter } from '@/lib/mushaf'
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

  function surahMeta(verseKey: string) {
    const id = surahNumber(verseKey)
    return {
      title: chapters.find((c) => c.id === id)?.englishName || `Surah ${id}`,
      part: juzForChapter(id),
    }
  }

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-600 dark:border-stone-700 dark:border-t-teal-500" />
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-[min(100%,42rem)] pb-16">
      <div className="mushaf-page-sheet space-y-5 px-4 py-5 sm:px-5">
        {displayRows.map((row, index) => {
          const num = verseNumber(row.verse_key)
          const prevSurah = index > 0 ? surahNumber(displayRows[index - 1].verse_key) : 0
          const curSurah = surahNumber(row.verse_key)
          const showHeader = curSurah !== prevSurah
          const { title, part } = surahMeta(row.verse_key)

          return (
            <article key={row.verse_key} className="space-y-3">
              {showHeader && (
                <div className="flex items-center justify-between border-b border-[var(--mushaf-sheet-border)] px-1 pb-2 pt-1">
                  <span className="text-sm font-medium text-[var(--mushaf-sheet-muted)]">{title}</span>
                  <span className="text-sm text-[var(--mushaf-sheet-muted)]">Juz {part}</span>
                </div>
              )}
              <p
                className="arabic-text text-center text-[var(--mushaf-sheet-text)]"
                dir="rtl"
                lang="ar"
              >
                {row.text_uthmani}
                <span
                  className="mx-1 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full border border-[var(--mushaf-sheet-border)] px-1 text-[0.65rem] font-medium text-[var(--mushaf-sheet-muted)]"
                  aria-label={`Verse ${num}`}
                >
                  {num}
                </span>
              </p>

              <div className="rounded-xl border border-[var(--mushaf-sheet-border)] bg-[var(--app-surface)] px-4 py-3.5">
                <p className="text-left text-[15px] leading-relaxed text-[var(--app-text)]">
                  <span className="text-[var(--app-muted)]">({num})</span>{' '}
                  {row.translation || (loading ? 'Loading…' : 'Translation unavailable.')}
                </p>
              </div>
            </article>
          )
        })}
      </div>

      <div
        className={cn(
          'pointer-events-none fixed bottom-28 left-1/2 z-10 -translate-x-1/2',
          'mushaf-page-footer rounded-full border border-[var(--mushaf-sheet-border)] bg-[var(--mushaf-sheet-bg)]/95 px-4 py-1'
        )}
      >
        {page}
      </div>
    </div>
  )
}
