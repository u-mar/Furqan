'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import { getChapters } from '@/lib/quran'
import { cn } from '@/lib/cn'
import type { Chapter } from '@/types'

export default function TestSurahSelectPage() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-bg)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-500 dark:border-stone-700"
          role="status"
          aria-label="Loading"
        />
      </main>
    )
  }

  return (
    <HomeScreen>
      <header className="mb-5 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4">
        <Link
          href="/test/select"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
          aria-label="Back to test modes"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[var(--app-text)]">Surah</h1>
          <p className="text-sm text-[var(--app-muted)]">Pick a surah to test</p>
        </div>
      </header>

      <div className="mb-5 max-h-[55vh] overflow-y-auto rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]">
        {chapters.map((chapter) => (
          <button
            key={chapter.id}
            type="button"
            onClick={() => setSelectedSurah(chapter)}
            className={cn(
              'flex w-full items-center border-b border-[var(--home-card-border)] px-4 py-3.5 text-left last:border-0 transition-colors',
              selectedSurah?.id === chapter.id && 'bg-teal-500/10'
            )}
          >
            <span className="w-8 text-sm font-medium text-[var(--app-muted)]">{chapter.id}</span>
            <span className="flex-1 font-medium text-[var(--app-text)]">{chapter.englishName}</span>
            <span className="text-sm text-teal-600 dark:text-teal-400">{chapter.name}</span>
          </button>
        ))}
      </div>

      <Link
        href={selectedSurah ? `/test?mode=surah&surah=${selectedSurah.id}` : '#'}
        onClick={(e) => !selectedSurah && e.preventDefault()}
        className={cn(
          'flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-semibold transition-colors',
          selectedSurah
            ? 'bg-teal-600 text-white hover:bg-teal-500 active:scale-[0.99]'
            : 'cursor-not-allowed bg-[var(--app-surface)] text-[var(--app-muted)]'
        )}
      >
        Start test
      </Link>
    </HomeScreen>
  )
}
