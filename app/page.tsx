'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpen, Play } from 'lucide-react'
import { getChapters } from '@/lib/quran'
import { cn } from '@/lib/cn'
import ThemeToggle from '@/components/ThemeToggle'
import type { Chapter } from '@/types'

type ScopeTab = 'surah' | 'juz'

export default function Home() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [scope, setScope] = useState<ScopeTab>('surah')
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters().then(setChapters).finally(() => setLoading(false))
  }, [])

  const canBegin = scope === 'surah' ? !!selectedSurah : !!selectedJuz

  const readHref = useMemo(() => {
    if (scope === 'surah' && selectedSurah) return `/read?mode=surah&surah=${selectedSurah.id}`
    if (scope === 'juz' && selectedJuz) return `/read?mode=juz&juz=${selectedJuz}`
    return '#'
  }, [scope, selectedSurah, selectedJuz])

  const testHref = useMemo(() => {
    if (scope === 'surah' && selectedSurah) return `/test?mode=surah&surah=${selectedSurah.id}`
    if (scope === 'juz' && selectedJuz) return `/test?mode=juz&juz=${selectedJuz}`
    return '#'
  }, [scope, selectedSurah, selectedJuz])

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--hifdh-bg)]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-teal-600" />
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-[var(--hifdh-bg)] text-[var(--hifdh-text)]">
      <header className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
        <h1 className="text-xl font-semibold tracking-tight">Hifdh</h1>
        <ThemeToggle />
      </header>

      <div className="shrink-0 flex gap-6 border-b border-[var(--hifdh-border)] px-5">
        {(['surah', 'juz'] as ScopeTab[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setScope(s)
              setSelectedJuz(null)
              setSelectedSurah(null)
            }}
            className={cn(
              '-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors',
              scope === s
                ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-[var(--hifdh-muted)] hover:text-[var(--hifdh-text)]'
            )}
          >
            {s === 'surah' ? 'Surah' : 'Juz'}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {scope === 'surah' ? (
          <SurahList chapters={chapters} selected={selectedSurah} onSelect={setSelectedSurah} />
        ) : (
          <JuzGrid selected={selectedJuz} onSelect={setSelectedJuz} />
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--hifdh-border)] bg-[var(--hifdh-bg)] px-4 py-4">
        <div className="flex gap-3">
          <Link
            href={canBegin ? readHref : '#'}
            onClick={(e) => !canBegin && e.preventDefault()}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors',
              canBegin
                ? 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:text-stone-950 dark:hover:bg-teal-500'
                : 'bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600'
            )}
          >
            <BookOpen className="h-4 w-4" />
            Read
          </Link>
          <Link
            href={canBegin ? testHref : '#'}
            onClick={(e) => !canBegin && e.preventDefault()}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-colors',
              canBegin
                ? 'border-teal-700 text-teal-700 hover:bg-teal-50 dark:border-teal-500 dark:text-teal-400 dark:hover:bg-teal-900/20'
                : 'border-stone-200 text-stone-400 dark:border-stone-700 dark:text-stone-600'
            )}
          >
            <Play className="h-4 w-4" />
            Test
          </Link>
        </div>
      </div>
    </main>
  )
}

function SurahList({
  chapters,
  selected,
  onSelect,
}: {
  chapters: Chapter[]
  selected: Chapter | null
  onSelect: (chapter: Chapter) => void
}) {
  return (
    <ul>
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <button
            onClick={() => onSelect(chapter)}
            className={cn(
              'flex w-full items-center gap-3 border-b border-[var(--hifdh-border)] px-5 py-3 text-left transition-colors',
              selected?.id === chapter.id
                ? 'bg-teal-50 dark:bg-teal-900/20'
                : 'hover:bg-stone-50 dark:hover:bg-stone-800/50'
            )}
          >
            <span className="w-7 shrink-0 text-right text-xs tabular-nums text-[var(--hifdh-muted)]">
              {chapter.id}
            </span>
            <span className="flex-1 text-sm font-medium text-[var(--hifdh-text)]">
              {chapter.englishName}
            </span>
            <span className="font-arabic text-sm text-teal-600 dark:text-teal-400">
              {chapter.name}
            </span>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[var(--hifdh-muted)]">
              {chapter.versesCount}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function JuzGrid({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (juz: number) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-3 p-5">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
        <button
          key={juz}
          onClick={() => onSelect(juz)}
          className={cn(
            'aspect-square rounded-xl text-sm font-medium transition-colors',
            selected === juz
              ? 'bg-teal-700 text-white dark:bg-teal-600 dark:text-stone-950'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700'
          )}
        >
          {juz}
        </button>
      ))}
    </div>
  )
}
