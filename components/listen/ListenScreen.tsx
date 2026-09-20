'use client'

import Link from 'next/link'
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Download, Loader2, Pause, Play, Search, Shuffle, WifiOff, X } from 'lucide-react'
import DownloadButton from '@/components/listen/DownloadButton'
import HeartButton from '@/components/listen/HeartButton'
import MiniPlayer from '@/components/listen/MiniPlayer'
import NowPlayingSheet from '@/components/listen/NowPlayingSheet'
import { Equalizer } from '@/components/listen/PlayerControls'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import ReciterPickerSheet from '@/components/listen/ReciterPickerSheet'
import { SleepButton, SleepSheet } from '@/components/listen/SleepControls'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useHydrated } from '@/hooks/useHydrated'
import { useDownloadsVersion, useListenState } from '@/hooks/useListen'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import { setAppSettings } from '@/lib/app-settings'
import { cn } from '@/lib/cn'
import { errorFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { onDownloadFinished, surahDownload } from '@/lib/listen-downloads'
import {
  changeReciter,
  getListenState,
  playSurah,
  togglePlay,
  type ListenStatus,
} from '@/lib/listen-player'
import { getChapters } from '@/lib/quran'
import { getQiraat, getReciterById, narrationChoices, RECITERS, topReciters, type Reciter } from '@/lib/reciters'
import { filterChapters } from '@/lib/search-chapters'
import { toast, toastError, toastSuccess } from '@/lib/toast'
import type { Chapter } from '@/types'
import { tr, useT } from '@/lib/i18n'

type Filter = 'all' | 'downloaded'

export default function ListenScreen() {
  const t = useT()
  const hydrated = useHydrated()
  const settings = useAppSettings()
  const reciter = getReciterById(settings.listenReciterId)
  const listen = useListenState()
  const downloadsVersion = useDownloadsVersion()
  const { favoriteIds, ready: favoritesReady } = useReciterFavorites()

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [offline, setOffline] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [sleepOpen, setSleepOpen] = useState(false)

  // Rows are memoised; they reach the current reciter through this.
  const reciterId = useRef(reciter.id)
  reciterId.current = reciter.id

  useEffect(() => {
    const sync = () => {
      const isOffline = !navigator.onLine
      setOffline(isOffline)
      if (isOffline) setFilter('downloaded')
    }
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => toastError(tr('The surah list could not load. Check your connection.')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(
    () =>
      onDownloadFinished((result) => {
        if (result.ok) {
          successFeedback()
          toastSuccess(`${result.name} is saved for offline`)
        } else {
          errorFeedback()
          toastError(tr('{name} could not be saved. Try again on Wi‑Fi.', { name: result.name }))
        }
      }),
    []
  )

  const lastError = useRef<string | null>(null)
  useEffect(() => {
    if (listen.error && listen.error !== lastError.current) {
      errorFeedback()
      toastError(listen.error)
    }
    lastError.current = listen.error
  }, [listen.error])

  const downloaded = useMemo(() => {
    void downloadsVersion // recount whenever a download finishes
    const ids = new Set<number>()
    for (const chapter of chapters) {
      if (surahDownload(reciter.id, chapter.id).state === 'done') ids.add(chapter.id)
    }
    return ids
  }, [chapters, reciter.id, downloadsVersion])

  const visible = useMemo(() => {
    const matches = filterChapters(chapters, query)
    return filter === 'downloaded' ? matches.filter((chapter) => downloaded.has(chapter.id)) : matches
  }, [chapters, query, filter, downloaded])

  const favorites = useMemo(
    () => favoriteIds.map((id) => RECITERS.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => Boolean(r)),
    [favoriteIds]
  )
  const picks = favorites.length ? favorites : topReciters()

  const selectReciter = useCallback((id: string) => {
    if (id === reciterId.current) return
    tapFeedback()
    setAppSettings({ listenReciterId: id })
    changeReciter(id)
  }, [])

  const play = useCallback((chapter: Chapter) => {
    tapFeedback()
    const current = getListenState()
    if (current.surah?.id === chapter.id && current.reciterId === reciterId.current) {
      togglePlay()
      return
    }
    void playSurah(chapter, reciterId.current)
  }, [])

  const shuffle = () => {
    const pool = visible.filter((chapter) => !offline || downloaded.has(chapter.id))
    const choices = pool.length > 1 ? pool.filter((chapter) => chapter.id !== listen.surah?.id) : pool
    if (!choices.length) {
      errorFeedback()
      toast(offline ? tr('Nothing downloaded to shuffle yet') : tr('Nothing to shuffle here'))
      return
    }
    tapFeedback()
    void playSurah(choices[Math.floor(Math.random() * choices.length)], reciter.id)
  }

  const listening = Boolean(listen.surah)

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        style={{
          paddingBottom: listening
            ? 'calc(7.25rem + env(safe-area-inset-bottom))'
            : 'max(1.75rem, env(safe-area-inset-bottom))',
        }}
      >
        <header className="flex items-center gap-3">
          <Link href="/" className="home-round ed-focus" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <h1 className="home-serif min-w-0 flex-1 truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
            {t('Listen')}</h1>
          <SleepButton onOpen={() => setSleepOpen(true)} />
        </header>

        {offline ? (
          <div className="home-card qari-enter mt-[18px] overflow-hidden rounded-2xl" role="status">
            <div className="set-row" style={{ paddingBlock: 9 }}>
              <span className="set-row__icon set-row__icon--neutral" aria-hidden>
                <WifiOff className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{t('You\'re offline')}</span>
                <span className="mt-px block text-[0.78125rem] text-[var(--home-muted)]">{t('Your downloaded surahs still play.')}</span>
              </span>
            </div>
          </div>
        ) : null}

        {hydrated ? (
          <ReciterCard reciter={reciter} onChoose={() => setPickerOpen(true)} onSelect={selectReciter} />
        ) : (
          <div className="home-card mt-[18px] flex items-center gap-3.5 rounded-[18px] px-3.5 py-3.5" aria-hidden>
            <div className="qari-skeleton h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="qari-skeleton h-2.5 w-16 rounded-full" />
              <div className="qari-skeleton h-4 w-40 rounded-full" />
              <div className="qari-skeleton h-2.5 w-24 rounded-full" />
            </div>
          </div>
        )}

        {favoritesReady ? (
          <div className="home-fade">
            <div className="mx-1 mb-2 mt-[22px] flex items-center justify-between gap-3">
              <h2 className="home-label">{favorites.length ? t('Your favourites') : t('Popular reciters')}</h2>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="ed-focus rounded-md text-[0.78125rem] font-semibold text-[var(--home-sage-deep)]"
              >
                {t('All reciters')}</button>
            </div>
            <div
              className={cn(
                picks.length <= 5
                  ? 'grid grid-cols-5 gap-1'
                  : 'qari-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1'
              )}
            >
              {picks.map((r) => {
                const active = r.id === reciter.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectReciter(r.id)}
                    aria-pressed={active}
                    className="ed-focus fx-press flex w-full min-w-[64px] flex-col items-center gap-[7px] rounded-xl pt-0.5"
                  >
                    <ReciterAvatar reciter={r} size={56} ring={active} />
                    <span
                      className={cn(
                        'max-w-[66px] truncate text-xs',
                        active ? 'font-bold text-[var(--home-heading)]' : 'font-medium text-[var(--home-muted)]'
                      )}
                    >
                      {r.name.split(' ').slice(-1)[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mt-[52px] grid grid-cols-5 gap-1" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="qari-skeleton h-14 w-14 rounded-full" />
                <div className="qari-skeleton h-2.5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        )}

        <h2 className="home-label mx-1 mb-2 mt-[22px] tabular-nums">
          {t('Surahs ·')} {loading ? '114' : visible.length}
        </h2>
        <label className="home-card flex h-12 items-center gap-2.5 rounded-[14px] px-3.5 focus-within:ring-2 focus-within:ring-[var(--home-sage)]">
          <Search className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            placeholder={t('Search surah')}
            aria-label={t('Search surahs')}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="fx-press -mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[var(--home-muted)]"
              aria-label={t('Clear search')}
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          ) : null}
        </label>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="ed-seg min-w-0 flex-1 grid-cols-2">
            {(['all', 'downloaded'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (filter !== value) tapFeedback()
                  setFilter(value)
                }}
                aria-pressed={filter === value}
                className="ed-seg__item ed-focus h-9 truncate px-1 text-[0.8125rem] font-semibold tabular-nums"
              >
                {value === 'all' ? t('All') : downloaded.size ? t('Downloaded · {size}', { size: downloaded.size }) : t('Downloaded')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={shuffle}
            className="home-card fx-press ed-focus flex h-11 shrink-0 items-center gap-[7px] rounded-2xl px-3.5 text-[0.8125rem] font-semibold text-[var(--home-heading)]"
          >
            <Shuffle className="h-4 w-4" strokeWidth={2} />
            {t('Shuffle')}</button>
        </div>

        <div className="home-card mt-3 overflow-hidden rounded-2xl">
          {loading ? (
            <ListSkeleton />
          ) : visible.length ? (
            visible.map((chapter, i) => (
              <Fragment key={chapter.id}>
                {i ? <div className="set-row__divider" style={{ marginLeft: 62 }} aria-hidden /> : null}
                <SurahRow
                  chapter={chapter}
                  reciterId={reciter.id}
                  status={listen.surah?.id === chapter.id ? listen.status : null}
                  unavailable={offline && !downloaded.has(chapter.id)}
                  onPlay={play}
                />
              </Fragment>
            ))
          ) : (
            <div className="home-fade flex flex-col items-center px-6 py-10 text-center">
              {filter === 'downloaded' && !query.trim() ? (
                <>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]">
                    <Download className="h-5 w-5" strokeWidth={1.9} />
                  </span>
                  <p className="mt-3 text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Nothing downloaded yet')}</p>
                  <p className="mt-1 max-w-[260px] text-[0.8125rem] leading-relaxed text-[var(--home-muted)]">
                    {t('Tap the arrow beside a surah to keep {name}’s recitation on this phone.', { name: reciter.name })}</p>
                </>
              ) : (
                <p className="text-sm text-[var(--home-muted)]">{t('No surah matches “{query}”.', { query: query.trim() })}</p>
              )}
            </div>
          )}
        </div>

        {offline && visible.length ? (
          <p className="mx-1 mt-2.5 flex items-center gap-1.5 text-[0.78125rem] text-[var(--home-muted)]">
            <Download className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            {t('On Wi‑Fi, tap the arrow on a surah to keep it.')}</p>
        ) : null}
      </div>

      <MiniPlayer onOpen={() => setPlayerOpen(true)} />
      <NowPlayingSheet
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        onOpenSleep={() => setSleepOpen(true)}
      />
      <SleepSheet open={sleepOpen} onClose={() => setSleepOpen(false)} />
      <ReciterPickerSheet
        open={pickerOpen}
        selectedId={reciter.id}
        onClose={() => setPickerOpen(false)}
        onSelect={selectReciter}
      />
    </main>
  )
}

/** Who is reciting, and the other narrations they recorded. */
function ReciterCard({
  reciter,
  onChoose,
  onSelect,
}: {
  reciter: Reciter
  onChoose: () => void
  onSelect: (reciterId: string) => void
}) {
  const t = useT()
  const narrations = narrationChoices(reciter)
  const rail = useRef<HTMLDivElement>(null)

  // Bring the chosen narration into view when the card opens or the reciter changes.
  useEffect(() => {
    const box = rail.current
    const on = box?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!box || !on) return
    box.scrollTo({ left: Math.max(0, on.offsetLeft - box.clientWidth / 2 + on.offsetWidth / 2), behavior: 'auto' })
  }, [reciter.id])

  return (
    <section className="home-card mt-[18px] rounded-[18px] px-3.5 pb-3 pt-3.5" aria-label={t('Reciting')}>
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={onChoose} className="ed-focus fx-press shrink-0 rounded-full" aria-label={t('Choose a reciter')}>
          <ReciterAvatar key={reciter.id} reciter={reciter} size={64} className="home-fade" />
        </button>
        <button type="button" onClick={onChoose} className="ed-focus min-w-0 flex-1 rounded-lg text-left">
          <span className="home-label block">{t('Reciting')}</span>
          <span
            key={reciter.id}
            className="home-fade home-serif mt-0.5 block truncate text-[1.25rem] font-semibold leading-snug tracking-[-0.015em] text-[var(--home-heading)]"
          >
            {reciter.name}
          </span>
          <span className="mt-px block truncate text-[0.8125rem] text-[var(--home-muted)]">
            {getQiraat(reciter.qiraat).short} · {reciter.style}
          </span>
        </button>
        <HeartButton reciter={reciter} className="-mr-1 self-start" />
      </div>

      {narrations.length > 1 ? (
        <div className="mt-3.5 border-t border-[var(--home-rule)] pt-3">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="home-label">{t('Narration')}</p>
            <p className="text-xs text-[var(--home-muted)]">{t('{count} available', { count: narrations.length })}</p>
          </div>
          <div
            ref={rail}
            className="qari-no-scrollbar -mx-3.5 flex snap-x gap-2 overflow-x-auto px-3.5 pb-0.5"
            role="radiogroup"
            aria-label={t('Narration')}
          >
            {narrations.map((variant) => {
              const info = getQiraat(variant.qiraat)
              const on = variant.qiraat === reciter.qiraat
              const via = info.label.includes(" 'an ") ? `'an ${info.label.split(" 'an ")[1]}` : info.label
              return (
                <button
                  key={variant.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    if (!on) {
                      tapFeedback()
                      onSelect(variant.id)
                    }
                  }}
                  className={cn(
                    'fx-press ed-focus relative min-w-[5.25rem] shrink-0 snap-start rounded-[14px] px-3.5 py-2 text-left transition-colors',
                    on ? 'ed-ink' : 'border border-[var(--home-rule-strong)] text-[var(--home-heading)] hover:bg-[var(--home-track)]'
                  )}
                >
                  <span className="block text-[0.9375rem] font-semibold leading-tight">{info.short}</span>
                  <span className={cn('mt-0.5 block whitespace-nowrap text-[0.6875rem] leading-tight', on ? 'opacity-70' : 'text-[var(--home-muted)]')}>
                    {via}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </section>
  )
}

const SurahRow = memo(function SurahRow({
  chapter,
  reciterId,
  status,
  unavailable,
  onPlay,
}: {
  chapter: Chapter
  reciterId: string
  /** This surah's play state, or null when another one (or nothing) is loaded. */
  status: ListenStatus | null
  unavailable: boolean
  onPlay: (chapter: Chapter) => void
}) {
  const t = useT()
  const active = status !== null
  const playing = status === 'playing'
  const loading = status === 'loading'

  return (
    <div
      className={cn(
        'flex min-h-[60px] items-center pr-1.5 transition-colors duration-300',
        active && 'bg-[color-mix(in_srgb,var(--home-sage)_7%,transparent)]'
      )}
    >
      <button
        type="button"
        onClick={() => onPlay(chapter)}
        disabled={unavailable}
        aria-label={`${playing || loading ? t('Pause') : t('Play')} ${chapter.englishName}`}
        className="ed-focus group flex min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pl-3.5 pr-2 text-left disabled:opacity-45"
      >
        <span
          className={cn(
            'home-serif flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-sm font-semibold tabular-nums transition-transform duration-150 group-active:scale-90',
            active ? 'ed-ink' : 'bg-[color-mix(in_srgb,var(--home-heading)_6%,transparent)] text-[var(--home-heading)]'
          )}
        >
          {active ? (
            <span key={loading ? 'loading' : playing ? 'pause' : 'play'} className="qari-swap flex">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} />
              ) : playing ? (
                <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={0} />
              ) : (
                <Play className="ml-0.5 h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              )}
            </span>
          ) : (
            chapter.id
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block truncate text-[0.9375rem] font-semibold',
              active ? 'text-[var(--home-sage-deep)]' : 'text-[var(--home-heading)]'
            )}
          >
            {chapter.englishName}
          </span>
          <span className="mt-px flex min-w-0 items-center gap-1.5 text-[0.78125rem] text-[var(--home-muted)]">
            <span className="amiri truncate text-[0.9375rem] leading-none">{chapter.name}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{chapter.versesCount} {t('ayahs')}</span>
          </span>
        </span>
        {playing || status === 'paused' ? <Equalizer paused={!playing} /> : null}
      </button>
      <DownloadButton reciterId={reciterId} chapter={chapter} disabled={unavailable} />
    </div>
  )
})

function ListSkeleton() {
  const t = useT()
  return (
    <div aria-busy aria-label={t('Loading surahs')}>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex h-[60px] items-center gap-3 px-3.5">
          <div className="qari-skeleton h-9 w-9 rounded-[10px]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="qari-skeleton h-3 w-28 rounded-full" />
            <div className="qari-skeleton h-2.5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
