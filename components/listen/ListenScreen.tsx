'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronDown,
  Play,
  Pause,
  Square,
  Loader2,
  Headphones,
  RotateCcw,
  RotateCw,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAppSettings } from '@/lib/app-settings'
import { RECITERS } from '@/lib/reciters'
import { filterChapters } from '@/lib/search-chapters'
import { getChapters } from '@/lib/quran'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useSurahPlayer } from '@/hooks/useSurahPlayer'
import type { Chapter } from '@/types'

export default function ListenScreen() {
  const settings = useAppSettings()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [query, setQuery] = useState('')
  const [reciterOpen, setReciterOpen] = useState(false)

  const { state, playSurah, togglePlayPause, seekRelative, stop, isActiveSurah } = useSurahPlayer(
    settings.reciterId
  )

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
      .finally(() => setLoadingChapters(false))
  }, [])

  const filtered = useMemo(() => filterChapters(chapters, query), [chapters, query])
  const currentReciter = RECITERS.find((r) => r.id === settings.reciterId) ?? RECITERS[0]

  function selectReciter(id: string) {
    setAppSettings({ reciterId: id })
    setReciterOpen(false)
  }

  function handlePlaySurah(chapter: Chapter) {
    if (isActiveSurah(chapter.id)) {
      togglePlayPause()
      return
    }
    playSurah(chapter.id, chapter.englishName, chapter.versesCount)
  }

  const progress =
    state.versesCount > 0 ? Math.round((state.currentAyah / state.versesCount) * 100) : 0

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-lg px-4 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="mb-5 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-teal-600 hover:bg-[var(--app-surface)] dark:text-teal-400"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-7 w-7" />
          </Link>
          <div className="flex items-center gap-2">
            <Headphones className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            <h1 className="text-xl font-bold">Listen</h1>
          </div>
        </header>

        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
            Reciter
          </p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setReciterOpen((v) => !v)}
              className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-left"
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
                      onClick={() => selectReciter(r.id)}
                      className={cn(
                        'flex w-full px-4 py-3 text-left text-sm text-[var(--app-text)] transition-colors hover:bg-teal-500/10',
                        r.id === settings.reciterId &&
                          'bg-teal-500/15 font-semibold text-teal-800 dark:text-teal-400'
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

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search surah…"
          className="mb-4 w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-teal-500/40"
        />

        {loadingChapters ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((chapter) => {
              const active = isActiveSurah(chapter.id)
              const isPlaying = active && state.playing && !state.loading

              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => handlePlaySurah(chapter)}
                    className={cn(
                      'flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors active:scale-[0.99]',
                      active
                        ? 'border-teal-500/50 bg-teal-500/10'
                        : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] hover:border-teal-500/20'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        active
                          ? 'bg-teal-600 text-white'
                          : 'bg-[var(--app-surface)] text-[var(--app-muted)]'
                      )}
                    >
                      {chapter.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{chapter.englishName}</span>
                      <span className="block truncate text-xs text-[var(--app-muted)]">
                        {chapter.name} · {chapter.versesCount} ayahs
                      </span>
                    </span>
                    <span className="shrink-0 text-teal-600 dark:text-teal-400">
                      {active && state.loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 fill-current" />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {state.surahId && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--home-card-border)] bg-[var(--app-surface)]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{state.surahName}</p>
                <p className="text-xs text-[var(--app-muted)]">
                  Ayah {state.currentAyah} / {state.versesCount}
                  {state.error && <span className="ml-2 text-red-500">{state.error}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => seekRelative(-15)}
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--app-muted)] active:scale-95"
                  aria-label="Rewind 15 seconds"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-[9px] font-semibold leading-none">15</span>
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white"
                  aria-label={state.playing ? 'Pause' : 'Play'}
                >
                  {state.loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : state.playing ? (
                    <Pause className="h-5 w-5 fill-current" />
                  ) : (
                    <Play className="h-5 w-5 fill-current" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => seekRelative(15)}
                  className="flex h-11 w-11 flex-col items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--app-muted)] active:scale-95"
                  aria-label="Forward 15 seconds"
                >
                  <RotateCw className="h-4 w-4" />
                  <span className="text-[9px] font-semibold leading-none">15</span>
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--app-muted)]"
                  aria-label="Stop"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
              <div
                className="h-full bg-teal-600 transition-all duration-300 dark:bg-teal-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
