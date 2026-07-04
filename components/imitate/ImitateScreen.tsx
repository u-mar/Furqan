'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronDown, Loader2, Mic } from 'lucide-react'
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
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [query, setQuery] = useState('')
  const [reciterOpen, setReciterOpen] = useState(false)
  const [selectedSurah, setSelectedSurah] = useState<number | null>(null)
  const [ayahCount, setAyahCount] = useState(0)
  const [loadingAyahs, setLoadingAyahs] = useState(false)
  const [recent, setRecent] = useState<PracticeRecord[]>([])

  const currentReciter = RECITERS.find((r) => r.id === settings.reciterId) ?? RECITERS[0]
  const filtered = useMemo(() => filterChapters(chapters, query), [chapters, query])
  const selectedChapter = chapters.find((c) => c.id === selectedSurah)

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
      .finally(() => setLoadingChapters(false))
    setRecent(getRecentPractice(5))
  }, [])

  useEffect(() => {
    if (!selectedSurah) return
    setLoadingAyahs(true)
    getVersesByChapter(selectedSurah)
      .then((verses) => setAyahCount(verses.length))
      .catch(() => setAyahCount(0))
      .finally(() => setLoadingAyahs(false))
  }, [selectedSurah])

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-lg px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="mb-5 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--home-sage-deep)] hover:bg-[var(--app-surface)]"
            aria-label="Back home"
          >
            <ChevronLeft className="h-7 w-7" />
          </Link>
          <div className="flex items-center gap-2">
            <Mic className="h-6 w-6 text-[var(--home-sage-deep)]" />
            <h1 className="home-serif text-xl font-semibold text-[var(--home-heading)]">Imitate</h1>
          </div>
        </header>

        <p className="mb-5 text-sm leading-relaxed text-[var(--app-muted)]">
          Choose a reciter and ayah. Listen, record yourself, and see how closely your voice matches.
        </p>

        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            Reciter
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setReciterOpen((v) => !v)}
              className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-left shadow-[var(--home-card-shadow)]"
            >
              <span className="font-medium text-[var(--app-text)]">{currentReciter.name}</span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 text-[var(--app-muted)] transition-transform',
                  reciterOpen && 'rotate-180'
                )}
              />
            </button>
            {reciterOpen && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-1 shadow-[var(--home-card-shadow)]">
                {RECITERS.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAppSettings({ reciterId: r.id })
                        setReciterOpen(false)
                      }}
                      className={cn(
                        'flex w-full px-4 py-3 text-left text-sm text-[var(--app-text)] transition-colors hover:bg-[var(--home-sage-soft)]',
                        r.id === settings.reciterId &&
                          'bg-[var(--home-sage-soft)] font-semibold text-[var(--home-sage-deep)]'
                      )}
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mb-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
              Recent practice
            </h2>
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={`${r.reciterId}-${r.surah}-${r.ayah}-${r.practicedAt}`}>
                  <Link
                    href={`/imitate/${r.surah}/${r.ayah}`}
                    className="flex items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
                  >
                    <span className="text-[var(--app-text)]">
                      Surah {r.surah} · Ayah {r.ayah}
                    </span>
                    <span className="font-semibold text-[var(--home-sage-deep)]">
                      {r.voiceSimilarity}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            {selectedSurah ? 'Pick an ayah' : 'Pick a surah'}
          </p>

          {selectedSurah && (
            <button
              type="button"
              onClick={() => setSelectedSurah(null)}
              className="mb-3 text-sm font-medium text-[var(--home-sage-deep)]"
            >
              ← All surahs
            </button>
          )}

          {!selectedSurah ? (
            <>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search surah…"
                className="mb-3 w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/35"
              />
              {loadingChapters ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--home-sage)]" />
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((chapter) => (
                    <li key={chapter.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedSurah(chapter.id)}
                        className="flex w-full items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3.5 text-left shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
                      >
                        <span className="font-medium text-[var(--home-heading)]">
                          {chapter.id}. {chapter.englishName}
                        </span>
                        <span className="text-xs text-[var(--app-muted)]">
                          {chapter.versesCount} ayahs
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--home-heading)]">
                {selectedChapter?.englishName ?? `Surah ${selectedSurah}`}
              </p>
              {loadingAyahs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--home-sage)]" />
                </div>
              ) : (
                <ul className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {Array.from({ length: ayahCount }, (_, i) => i + 1).map((ayah) => (
                    <li key={ayah}>
                      <Link
                        href={`/imitate/${selectedSurah}/${ayah}`}
                        className="flex h-12 items-center justify-center rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-sm font-semibold text-[var(--home-heading)] shadow-sm transition-colors hover:bg-[var(--home-sage-soft)] active:scale-95"
                      >
                        {ayah}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
