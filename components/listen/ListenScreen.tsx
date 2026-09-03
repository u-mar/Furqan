'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  Play,
  Pause,
  Square,
  Loader2,
  Download,
  Check,
  Headphones,
  RotateCcw,
  RotateCw,
  Search,
  Shuffle,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAppSettings } from '@/lib/app-settings'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import ReciterPickerSheet from '@/components/listen/ReciterPickerSheet'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import {
  getQiraat,
  getReciterById,
  getReciterVariants,
  topReciters,
  RECITERS,
  type QiraatId,
  type Reciter,
} from '@/lib/reciters'
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [downloadingSurah, setDownloadingSurah] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloaded, setDownloaded] = useState<Record<number, boolean>>({})
  const [downloadedOnly, setDownloadedOnly] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const currentReciter = getReciterById(settings.listenReciterId)
  const { favoriteIds, isFavorite, toggle: toggleFavorite, atLimit: favoritesAtLimit } =
    useReciterFavorites()

  const { state, playSurah, togglePlayPause, seekRelative, seekTo, stop, isActiveSurah } =
    useSurahPlayer(currentReciter.id)

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

  const favoriteReciters = useMemo(
    () =>
      favoriteIds
        .map((id) => RECITERS.find((r) => r.id === id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [favoriteIds]
  )

  const usingFavorites = favoriteReciters.length > 0
  const quickPicks = useMemo(() => {
    if (favoriteReciters.length > 0) return favoriteReciters
    return topReciters()
  }, [favoriteReciters])

  /** Other narrations recorded by the same person, e.g. Hafs vs Susi. */
  const reciterVariants = useMemo(() => getReciterVariants(currentReciter), [currentReciter])
  const qiraatOptions = useMemo(() => {
    const byQiraat = new Map<QiraatId, Reciter>()
    for (const v of reciterVariants) {
      const existing = byQiraat.get(v.qiraat)
      if (!existing || (v.style === 'Murattal' && existing.style !== 'Murattal')) {
        byQiraat.set(v.qiraat, v)
      }
    }
    return [...byQiraat.values()].sort((a, b) => {
      if (a.qiraat === 'hafs') return -1
      if (b.qiraat === 'hafs') return 1
      return getQiraat(a.qiraat).short.localeCompare(getQiraat(b.qiraat).short)
    })
  }, [reciterVariants])

  useEffect(() => {
    const next: Record<number, boolean> = {}
    for (const chapter of chapters) {
      next[chapter.id] = isSurahAudioDownloaded(currentReciter.id, chapter.id)
    }
    setDownloaded(next)
  }, [chapters, currentReciter.id])

  function selectReciter(id: string) {
    setAppSettings({ listenReciterId: id })
  }

  function handlePlaySurah(chapter: Chapter) {
    if (isActiveSurah(chapter.id)) {
      togglePlayPause()
      return
    }
    if (isOffline && !downloaded[chapter.id]) return
    playSurah(chapter.id, chapter.englishName, chapter.versesCount)
  }

  function playRandom() {
    if (visibleChapters.length === 0) return
    const pick = visibleChapters[Math.floor(Math.random() * visibleChapters.length)]
    playSurah(pick.id, pick.englishName, pick.versesCount)
  }

  async function handleDownloadSurah(chapter: Chapter) {
    if (downloadingSurah === chapter.id) return
    setDownloadingSurah(chapter.id)
    setDownloadProgress(0)
    try {
      await downloadSurahAudio(currentReciter.id, chapter.id, chapter.versesCount, (p) =>
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

  const playbackProgress =
    state.duration > 0 ? Math.min(100, Math.round((state.currentTime / state.duration) * 100)) : 0

  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[var(--app-bg)] text-[var(--app-text)] [overscroll-behavior-x:none] [touch-action:pan-y]">
      {/* Ambient wash tinted by the current reciter — the Listen screen takes its
          colour from whoever you're listening to, not the app's home palette. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[52vh]"
        style={{
          background: `radial-gradient(120% 70% at 50% -10%, ${currentReciter.accent[0]}33, transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-lg px-4 pb-[max(9rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        {/* Compact toolbar */}
        <header className="reveal mb-6 flex items-center gap-2">
          <Link
            href="/"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[var(--home-heading)] transition-colors hover:bg-[var(--home-card-bg)]"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Headphones className="h-4 w-4 shrink-0 text-[var(--home-muted)]" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--home-muted)]">
              Listen
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="shrink-0 rounded-full border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-1.5 text-xs font-bold text-[var(--home-heading)]"
          >
            All reciters
          </button>
        </header>

        {/* Now-reciting cover — album-art style, coloured by the reciter */}
        <section className="reveal mb-7 flex items-center gap-4" style={{ animationDelay: '60ms' }}>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Change reciter"
            className="shrink-0 transition-transform active:scale-95"
          >
            <ReciterAvatar reciter={currentReciter} size={104} square />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--home-muted)]">
              Reciting
            </p>
            <div className="flex items-start justify-between gap-2">
              <h1 className="home-serif mt-0.5 text-[1.7rem] font-semibold leading-[1.15] text-[var(--home-heading)]">
                {currentReciter.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  if (!isFavorite(currentReciter.id) && favoritesAtLimit) return
                  toggleFavorite(currentReciter.id)
                }}
                disabled={!isFavorite(currentReciter.id) && favoritesAtLimit}
                className={cn(
                  'mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90',
                  isFavorite(currentReciter.id)
                    ? 'text-rose-500'
                    : favoritesAtLimit
                      ? 'text-[var(--home-muted)] opacity-40'
                      : 'text-[var(--home-muted)] hover:text-rose-400'
                )}
                aria-label={
                  isFavorite(currentReciter.id)
                    ? `Remove ${currentReciter.name} from favorites`
                    : `Add ${currentReciter.name} to favorites`
                }
                aria-pressed={isFavorite(currentReciter.id)}
              >
                <Heart
                  className={cn('h-5 w-5', isFavorite(currentReciter.id) && 'fill-current')}
                />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${currentReciter.accent[0]}, ${currentReciter.accent[1]})`,
                }}
              >
                {getQiraat(currentReciter.qiraat).short}
              </span>
              {currentReciter.style !== 'Murattal' && (
                <span className="rounded-full border border-[var(--home-card-border)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--home-muted)]">
                  {currentReciter.style}
                </span>
              )}
            </div>

            {qiraatOptions.length > 1 && (
              <div className="mt-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--home-muted)]">
                  Also recites in
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {qiraatOptions.map((variant) => {
                    const isCurrent = variant.id === currentReciter.id
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => selectReciter(variant.id)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                          isCurrent
                            ? 'text-white'
                            : 'bg-[var(--app-surface)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
                        )}
                        style={
                          isCurrent
                            ? {
                                background: `linear-gradient(135deg, ${variant.accent[0]}, ${variant.accent[1]})`,
                              }
                            : undefined
                        }
                        aria-pressed={isCurrent}
                      >
                        {getQiraat(variant.qiraat).short}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <p className="mt-2.5 text-[11px] text-[var(--home-muted)]">
              {RECITERS.length} reciters · {new Set(RECITERS.map((r) => r.qiraat)).size} qira&apos;at
            </p>
          </div>
        </section>

        {isOffline ? (
          <p className="mb-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:text-amber-100">
            {OFFLINE_AUDIO_HINT}
          </p>
        ) : null}

        {/* Quick pick reciters — your favorites once you have some, else a
            curated bench of well-known reciters */}
        <section className="reveal mb-5" style={{ animationDelay: '80ms' }}>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
              {usingFavorites && <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />}
              {usingFavorites ? 'Your favorites' : 'Popular reciters'}
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-[11px] font-semibold text-[var(--home-sage-deep)]"
            >
              {usingFavorites ? 'Edit' : 'Browse all'}
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickPicks.map((r) => {
              const active = r.id === currentReciter.id
              return (
                <div key={r.id} className="relative flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => selectReciter(r.id)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <ReciterAvatar reciter={r} size={56} ring={active} />
                    <span
                      className={cn(
                        'line-clamp-2 text-center text-[10px] font-medium leading-tight',
                        active ? 'text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
                      )}
                    >
                      {r.name.split(' ').slice(-1)[0]}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isFavorite(r.id) && favoritesAtLimit) return
                      toggleFavorite(r.id)
                    }}
                    disabled={!isFavorite(r.id) && favoritesAtLimit}
                    className={cn(
                      'absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--app-bg)] shadow-sm transition-colors active:scale-90',
                      isFavorite(r.id)
                        ? 'text-rose-500'
                        : favoritesAtLimit
                          ? 'text-[var(--home-muted)] opacity-40'
                          : 'text-[var(--home-muted)]'
                    )}
                    aria-label={
                      isFavorite(r.id) ? `Remove ${r.name} from favorites` : `Add ${r.name} to favorites`
                    }
                    aria-pressed={isFavorite(r.id)}
                  >
                    <Heart className={cn('h-3 w-3', isFavorite(r.id) && 'fill-current')} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Search + filters */}
        <div className="reveal mb-3" style={{ animationDelay: '140ms' }}>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surah…"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-3 pl-9 pr-3 text-sm placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--home-muted)]">
              {visibleChapters.length} surah{visibleChapters.length === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={playRandom}
                className="flex items-center gap-1.5 rounded-full border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--home-heading)]"
              >
                <Shuffle className="h-3.5 w-3.5" />
                Shuffle
              </button>
              <button
                type="button"
                onClick={() => setDownloadedOnly((v) => !v)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  downloadedOnly
                    ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                    : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-[var(--home-muted)]'
                )}
              >
                Offline
              </button>
            </div>
          </div>
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
                      'flex min-h-[64px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left shadow-[var(--home-card-shadow)] transition-all',
                      active
                        ? 'border-transparent'
                        : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] active:scale-[0.99]'
                    )}
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${currentReciter.accent[0]}18, ${currentReciter.accent[1]}0d)`,
                            boxShadow: `0 0 0 1.5px ${currentReciter.accent[1]}55, 0 10px 24px -16px ${currentReciter.accent[1]}`,
                          }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => handlePlaySurah(chapter)}
                      disabled={isOffline && !downloaded[chapter.id]}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-3 text-left',
                        isOffline && !downloaded[chapter.id] && 'cursor-not-allowed opacity-55'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition-colors',
                          !active && 'bg-[var(--app-surface)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]',
                          active && 'text-white'
                        )}
                        style={
                          active
                            ? {
                                background: `linear-gradient(135deg, ${currentReciter.accent[0]}, ${currentReciter.accent[1]})`,
                                boxShadow: `0 8px 16px -8px ${currentReciter.accent[1]}`,
                              }
                            : undefined
                        }
                      >
                        {isPlaying ? (
                          <Pause className="h-[18px] w-[18px] fill-current" />
                        ) : active && state.loading ? (
                          <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        ) : (
                          chapter.id
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[var(--home-heading)]">
                          {chapter.englishName}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[var(--home-muted)]">
                          <span className="amiri truncate">{chapter.name}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{chapter.versesCount} ayahs</span>
                        </span>
                      </span>
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{
                          color: active ? currentReciter.accent[1] : 'var(--home-muted)',
                          background: active ? `${currentReciter.accent[1]}1a` : undefined,
                        }}
                      >
                        {isPlaying ? (
                          <span className="flex h-4 items-end gap-0.5" aria-hidden>
                            <span className="w-0.5 animate-pulse bg-current" style={{ height: '60%' }} />
                            <span className="w-0.5 animate-pulse bg-current" style={{ height: '100%', animationDelay: '120ms' }} />
                            <span className="w-0.5 animate-pulse bg-current" style={{ height: '45%', animationDelay: '240ms' }} />
                          </span>
                        ) : (
                          <Play className="h-4 w-4 fill-current" />
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDownloadSurah(chapter)}
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 transition-colors',
                        downloadingSurah === chapter.id
                          ? 'text-[var(--home-sage-deep)] ring-[var(--home-sage-deep)]/40'
                          : downloaded[chapter.id]
                            ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
                            : 'text-[var(--home-muted)] ring-[var(--home-card-border)]'
                      )}
                      aria-label={
                        downloaded[chapter.id] ? 'Downloaded for offline' : 'Download surah for offline'
                      }
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
                    <p className="px-3 pt-1.5 text-[11px] text-[var(--home-sage-deep)]">
                      Downloading… {downloadProgress}%
                    </p>
                  )}
                </li>
              )
            })}
            {visibleChapters.length === 0 && (
              <li className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-5 text-center text-sm text-[var(--home-muted)]">
                {downloadedOnly
                  ? 'No downloaded surahs for this reciter yet.'
                  : 'No surah matches your search.'}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Now playing bar */}
      {state.surahId && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--home-card-border)] bg-[var(--app-surface)]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          <div className="mx-auto max-w-lg">
            <div className="mb-2.5 flex items-center gap-3">
              <ReciterAvatar reciter={currentReciter} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--home-heading)]">
                  {state.surahName}
                </p>
                <p className="truncate text-xs text-[var(--home-muted)]">
                  {currentReciter.name}
                  {state.error && <span className="ml-2 text-red-500">{state.error}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => seekRelative(-15)}
                  className="flex h-10 w-10 flex-col items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--home-muted)] active:scale-95"
                  aria-label="Rewind 15 seconds"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                  style={{
                    background: `linear-gradient(135deg, ${currentReciter.accent[0]}, ${currentReciter.accent[1]})`,
                    boxShadow: `0 10px 24px -10px ${currentReciter.accent[1]}`,
                  }}
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
                  className="flex h-10 w-10 flex-col items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--home-muted)] active:scale-95"
                  aria-label="Forward 15 seconds"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={stop}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--home-card-border)] text-[var(--home-muted)]"
                  aria-label="Stop"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <input
                type="range"
                min={0}
                max={state.duration || 0}
                step={0.1}
                value={state.currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                disabled={!state.duration}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: `linear-gradient(to right, ${currentReciter.accent[1]} ${playbackProgress}%, var(--home-track) ${playbackProgress}%)`,
                }}
                aria-label="Seek within surah"
              />
              <div className="flex justify-between text-[11px] font-medium tabular-nums text-[var(--home-muted)]">
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReciterPickerSheet
        open={pickerOpen}
        selectedId={currentReciter.id}
        onClose={() => setPickerOpen(false)}
        onSelect={selectReciter}
      />
    </main>
  )
}
