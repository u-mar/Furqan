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
  Download,
  Check,
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
import {
  downloadSurahAudio,
  isSurahAudioDownloaded,
  OFFLINE_AUDIO_HINT,
} from '@/lib/offline-audio'
import type { Chapter } from '@/types'

export default function ListenScreen() {
  const settings = useAppSettings()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [query, setQuery] = useState('')
  const [reciterOpen, setReciterOpen] = useState(false)
  const [downloadingSurah, setDownloadingSurah] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloaded, setDownloaded] = useState<Record<number, boolean>>({})
  const [downloadedOnly, setDownloadedOnly] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const { state, surahProgress, playSurah, togglePlayPause, seekRelative, seekTo, stop, isActiveSurah } =
    useSurahPlayer(settings.reciterId)

  useEffect(() => {
    const syncOnline = () => setIsOffline(!navigator.onLine)
    syncOnline()
    window.addEventListener('online', syncOnline)
    window.addEventListener('offline', syncOnline)
    return () => {
      window.removeEventListener('online', syncOnline)
      window.removeEventListener('offline', syncOnline)
    }
  }, [])

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
      .finally(() => setLoadingChapters(false))
  }, [])

  const filtered = useMemo(() => filterChapters(chapters, query), [chapters, query])
  const visibleChapters = useMemo(
    () => (downloadedOnly ? filtered.filter((chapter) => downloaded[chapter.id]) : filtered),
    [downloadedOnly, downloaded, filtered]
  )
  const currentReciter = RECITERS.find((r) => r.id === settings.reciterId) ?? RECITERS[0]

  useEffect(() => {
    const next: Record<number, boolean> = {}
    for (const chapter of chapters) {
      next[chapter.id] = isSurahAudioDownloaded(currentReciter.folder, chapter.id)
    }
    setDownloaded(next)
  }, [chapters, currentReciter.folder])

  function selectReciter(id: string) {
    setAppSettings({ reciterId: id })
    setReciterOpen(false)
  }

  function handlePlaySurah(chapter: Chapter) {
    if (isActiveSurah(chapter.id)) {
      togglePlayPause()
      return
    }
    if (isOffline && !downloaded[chapter.id]) {
      return
    }
    playSurah(chapter.id, chapter.englishName, chapter.versesCount)
  }

  async function handleDownloadSurah(chapter: Chapter) {
    if (downloadingSurah === chapter.id) return
    setDownloadingSurah(chapter.id)
    setDownloadProgress(0)
    try {
      await downloadSurahAudio(currentReciter.folder, chapter.id, chapter.versesCount, (p) =>
        setDownloadProgress(p)
      )
      setDownloaded((prev) => ({ ...prev, [chapter.id]: true }))
    } catch {
      // keep silent; playback remains online
    } finally {
      setDownloadingSurah(null)
      setDownloadProgress(0)
    }
  }

  const ayahProgress =
    state.duration > 0 ? Math.min(100, Math.round((state.currentTime / state.duration) * 100)) : 0

  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto max-w-lg px-4 pb-[max(7rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="mb-5 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--home-sage-deep)] hover:bg-[var(--app-surface)]"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-7 w-7" />
          </Link>
          <div className="flex items-center gap-2">
            <Headphones className="h-6 w-6 text-[var(--home-sage-deep)]" />
            <h1 className="home-serif text-xl font-semibold text-[var(--home-heading)]">Listen</h1>
          </div>
        </header>

        {isOffline ? (
          <p className="mb-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            {OFFLINE_AUDIO_HINT}
          </p>
        ) : null}

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

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search surah…"
          className="mb-4 w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm placeholder:text-[var(--app-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/35"
        />
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs text-[var(--app-muted)]">
            {visibleChapters.length} surah{visibleChapters.length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => setDownloadedOnly((v) => !v)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              downloadedOnly
                ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-[var(--app-muted)]'
            )}
          >
            {downloadedOnly ? 'Downloaded only: on' : 'Downloaded only'}
          </button>
        </div>

        {loadingChapters ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--home-sage-deep)]" />
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleChapters.map((chapter) => {
              const active = isActiveSurah(chapter.id)
              const isPlaying = active && state.playing && !state.loading

              return (
                <li key={chapter.id}>
                  <div
                    className={cn(
                      'flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                      active
                        ? 'border-[var(--home-sage-deep)]/55 bg-[var(--home-sage-soft)]'
                        : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)]'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handlePlaySurah(chapter)}
                      disabled={isOffline && !downloaded[chapter.id]}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99]',
                        isOffline && !downloaded[chapter.id] && 'cursor-not-allowed opacity-55'
                      )}
                    >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                        active
                          ? 'bg-[var(--home-sage-deep)] text-white'
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
                    <span className="shrink-0 text-[var(--home-sage-deep)]">
                      {active && state.loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : isPlaying ? (
                        <Pause className="h-5 w-5 fill-current" />
                      ) : (
                        <Play className="h-5 w-5 fill-current" />
                      )}
                    </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadSurah(chapter)}
                      className={cn(
                        'ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                        downloadingSurah === chapter.id
                          ? 'border-[var(--home-sage-deep)] text-[var(--home-sage-deep)]'
                          : downloaded[chapter.id]
                            ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : 'border-[var(--home-card-border)] text-[var(--app-muted)]'
                      )}
                      aria-label={
                        downloaded[chapter.id] ? 'Downloaded for offline' : 'Download surah for offline'
                      }
                      title={downloaded[chapter.id] ? 'Downloaded' : 'Download for offline'}
                    >
                      {downloadingSurah === chapter.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : downloaded[chapter.id] ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {downloadingSurah === chapter.id && (
                    <p className="px-3 pt-1 text-[11px] text-[var(--home-sage-deep)]">
                      Downloading… {downloadProgress}%
                    </p>
                  )}
                </li>
              )
            })}
            {visibleChapters.length === 0 && (
              <li className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-5 text-center text-sm text-[var(--app-muted)]">
                {downloadedOnly
                  ? 'No downloaded surahs for this reciter yet.'
                  : 'No surah matches your search.'}
              </li>
            )}
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
                  Full surah · Ayah {state.currentAyah} of {state.versesCount}
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
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--home-sage-deep)] text-white"
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
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--app-muted)]">
                  <span>Surah progress</span>
                  <span className="tabular-nums">{surahProgress}%</span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
                  role="progressbar"
                  aria-valuenow={surahProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Full surah playback progress"
                >
                  <div
                    className="h-full rounded-full bg-[var(--home-sage-deep)] transition-[width] duration-300"
                    style={{ width: `${surahProgress}%` }}
                  />
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={state.duration || 0}
                step={0.1}
                value={state.currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                disabled={!state.duration}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-teal-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-stone-700 dark:accent-teal-500"
                style={{
                  background: `linear-gradient(to right, var(--home-sage-deep) ${ayahProgress}%, rgb(229 231 235) ${ayahProgress}%)`,
                }}
                aria-label="Seek within current ayah"
              />
              <div className="flex justify-between text-[11px] font-medium tabular-nums text-[var(--app-muted)]">
                <span>This ayah {formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
