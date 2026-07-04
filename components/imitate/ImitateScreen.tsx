'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, Mic } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import { useAppSettings } from '@/hooks/useAppSettings'
import { setAppSettings } from '@/lib/app-settings'
import { RECITERS } from '@/lib/reciters'
import { filterChapters } from '@/lib/search-chapters'
import { getChapters, getVersesByChapter } from '@/lib/quran'
import { getRecentPractice } from '@/lib/imitate-progress'
import type { PracticeRecord } from '@/lib/imitate-progress'
import type { Chapter } from '@/types'
import { cn } from '@/lib/cn'

export default function ImitateScreen() {
  const settings = useAppSettings()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [query, setQuery] = useState('')
  const [reciterOpen, setReciterOpen] = useState(false)
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null)
  const [ayahCount, setAyahCount] = useState(0)
  const [recent, setRecent] = useState<PracticeRecord[]>([])

  const currentReciter = RECITERS.find((r) => r.id === settings.reciterId) ?? RECITERS[0]
  const filtered = useMemo(() => filterChapters(chapters, query), [chapters, query])

  useEffect(() => {
    getChapters().then(setChapters).catch(() => {})
    setRecent(getRecentPractice(5))
  }, [])

  useEffect(() => {
    if (!selectedSurah) return
    getVersesByChapter(selectedSurah)
      .then((verses) => setAyahCount(verses.length))
      .catch(() => setAyahCount(0))
  }, [selectedSurah])

  return (
    <HomeScreen className="max-w-lg mx-auto">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--app-muted)] hover:bg-[var(--app-surface)]"
          aria-label="Back home"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-[var(--home-sage)]" />
          <h1 className="home-serif text-xl font-semibold text-[var(--home-heading)]">Imitate</h1>
        </div>
      </header>

      <p className="mb-6 text-sm leading-relaxed text-[var(--app-muted)]">
        Pick a reciter and ayah. Listen, record yourself, and see how similar your voice sounds.
      </p>

      <div className="relative mb-4">
        <button
          type="button"
          onClick={() => setReciterOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm font-medium"
        >
          <span>{currentReciter.name}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', reciterOpen && 'rotate-180')} />
        </button>
        {reciterOpen && (
          <ul className="absolute z-20 mt-2 max-h-52 w-full overflow-y-auto rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-1 shadow-lg">
            {RECITERS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAppSettings({ reciterId: r.id })
                    setReciterOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-2.5 text-left text-sm hover:bg-teal-500/10',
                    r.id === settings.reciterId && 'font-semibold text-teal-700 dark:text-teal-400'
                  )}
                >
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {recent.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-[var(--home-heading)]">Recent practice</h2>
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={`${r.reciterId}-${r.surah}-${r.ayah}-${r.practicedAt}`}>
                <Link
                  href={`/imitate/${r.surah}/${r.ayah}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm"
                >
                  <span>
                    Surah {r.surah} · Ayah {r.ayah}
                  </span>
                  <span className="font-semibold text-[var(--home-sage)]">{r.voiceSimilarity}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search surah…"
        className="mb-3 w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--home-sage)]/40"
      />

      {!selectedSurah ? (
        <ul className="space-y-2">
          {filtered.map((chapter) => (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => setSelectedSurah(chapter.id)}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-left text-sm font-medium hover:bg-[var(--app-surface)]"
              >
                {chapter.id}. {chapter.englishName}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setSelectedSurah(null)}
            className="mb-3 text-sm text-[var(--home-sage)]"
          >
            ← All surahs
          </button>
          <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {Array.from({ length: ayahCount }, (_, i) => i + 1).map((ayah) => (
              <li key={ayah}>
                <Link
                  href={`/imitate/${selectedSurah}/${ayah}`}
                  className="flex h-11 items-center justify-center rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-sm font-medium hover:bg-[var(--home-sage-soft)]"
                >
                  {ayah}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HomeScreen>
  )
}
