'use client'

import Link from 'next/link'
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, Download, Loader2, Pause, Play, Search, Shuffle, WifiOff, X } from 'lucide-react'
import { SectionTitle } from '@/components/home/HomeSections'
import DownloadButton from '@/components/listen/DownloadButton'
import HeartButton from '@/components/listen/HeartButton'
import MiniPlayer from '@/components/listen/MiniPlayer'
import NowPlayingSheet from '@/components/listen/NowPlayingSheet'
import { Equalizer } from '@/components/listen/PlayerControls'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import ReciterPickerSheet from '@/components/listen/ReciterPickerSheet'
import { NatureButton, NatureDock, NatureSheet } from '@/components/listen/NatureControls'
import { SleepSheet } from '@/components/listen/SleepControls'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useHydrated } from '@/hooks/useHydrated'
import { useDownloadsVersion, useListenState } from '@/hooks/useListen'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import { setAppSettings } from '@/lib/app-settings'
import { BOTTOM_NAV_HEIGHT_REM, BOTTOM_NAV_RAISE_REM } from '@/lib/bottom-nav'
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
import { getQiraat, getReciterById, hasSurah, narrationChoices, RECITERS, topReciters, type Reciter } from '@/lib/reciters'
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
  const [natureOpen, setNatureOpen] = useState(false)

  // Home's sheikhs open Listen with that sheikh chosen (?reciter=), its
  // "See all" with every reciter showing (?reciters=1), its player with Now
  // playing open (?player=1), and ?nature=1 with Nature mode showing.
  useEffect(() => {
    const url = new URL(window.location.href)
    const asked = url.searchParams.get('reciter')
    const nature = url.searchParams.get('nature') === '1'
    const all = url.searchParams.get('reciters') === '1'
    const player = url.searchParams.get('player') === '1'
    if (!asked && !nature && !all && !player) return
    if (asked && RECITERS.some((r) => r.id === asked)) {
      setAppSettings({ listenReciterId: asked })
      changeReciter(asked)
    }
    if (nature) setNatureOpen(true)
    if (all) setPickerOpen(true)
    if (player && getListenState().surah) setPlayerOpen(true)
    url.searchParams.delete('player')
    url.searchParams.delete('reciters')
    url.searchParams.delete('reciter')
    url.searchParams.delete('nature')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])

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
    // Only the surahs this reciter has recorded.
    const matches = filterChapters(chapters, query).filter((chapter) => hasSurah(reciter, chapter.id))
    return filter === 'downloaded' ? matches.filter((chapter) => downloaded.has(chapter.id)) : matches
  }, [chapters, query, filter, downloaded, reciter])

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

  // The row of reciters is wider than the screen: the chosen one is brought into view.
  const picksRail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const box = picksRail.current
    const on = box?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!box || !on) return
    box.scrollTo({ left: Math.max(0, on.offsetLeft - box.clientWidth / 2 + on.offsetWidth / 2), behavior: 'smooth' })
  }, [reciter.id, favoritesReady])

  return (
    <main className="cool-page min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        style={{
          // Listen always shows the bottom tab bar; the mini player, when playing, docks just above it.
          paddingBottom: listening
            ? `calc(${BOTTOM_NAV_HEIGHT_REM + BOTTOM_NAV_RAISE_REM}rem + 5.25rem + env(safe-area-inset-bottom))`
            : `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1.25rem + var(--listen-dock, 0px))`,
        }}
      >
        <header className="flex items-center gap-3">
          <Link href="/" className="home-round ed-focus" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[1.375rem] font-bold leading-tight tracking-[-0.01em] text-[var(--home-heading)]">
            {t('Listen')}</h1>
          <NatureButton onOpen={() => setNatureOpen(true)} />
        </header>

        {offline ? (
          <div className="home-card qari-enter mt-[18px] overflow-hidden rounded-2xl" role="status">
            <div className="set-row" style={{ paddingBlock: 9 }}>
              <span className="set-row__icon set-row__icon--neutral" aria-hidden>
                <WifiOff className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{t('You\'re offline')}</span>
                <span className="mt-px block text-[0.8125rem] text-[var(--home-muted)]">{t('Your downloaded surahs still play.')}</span>
              </span>
            </div>
          </div>
        ) : null}

        {hydrated ? (
          <ReciterCard reciter={reciter} onChoose={() => setPickerOpen(true)} onSelect={selectReciter} />
        ) : (
          <div className="home-card mt-4 h-[7.5rem] rounded-[1.25rem]" aria-hidden />
        )}

        {favoritesReady ? (
          <div className="home-fade mt-5">
            <SectionTitle star more={{ onClick: () => setPickerOpen(true), label: t('All reciters') }}>
              {favorites.length ? t('Your favourites') : t('Popular reciters')}
            </SectionTitle>
            <div ref={picksRail} className="qari-no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {picks.map((r) => {
                const active = r.id === reciter.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => selectReciter(r.id)}
                    aria-pressed={active}
                    className={cn(
                      'ed-focus fx-press flex w-[5.25rem] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 pb-2 pt-1.5 text-center transition-colors',
                      active && 'bg-[var(--home-card-bg)]'
                    )}
                  >
                    <ReciterAvatar reciter={r} size={56} />
                    <span
                      className={cn(
                        'line-clamp-2 text-[0.75rem] leading-snug',
                        active ? 'font-semibold text-[var(--home-heading)]' : 'font-medium text-[var(--home-muted)]'
                      )}
                    >
                      {r.name}
                    </span>
                    <span
                      className={cn('h-[3px] w-4 rounded-full bg-[var(--home-sage)] transition-opacity', active ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="mt-5 h-[8.25rem]" aria-hidden />
        )}

        <div className="mt-5">
          <SectionTitle star>
            <span className="tabular-nums">
              {t('Surahs ·')} {loading ? '114' : visible.length}
            </span>
          </SectionTitle>
        </div>
        <label className="home-card flex h-10 items-center gap-2 rounded-xl px-3 focus-within:ring-2 focus-within:ring-[var(--home-sage)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputMode="search"
            enterKeyHint="search"
            placeholder={t('Search surah')}
            aria-label={t('Search surahs')}
            className="h-full min-w-0 flex-1 bg-transparent text-[0.875rem] text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
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

        <div className="mt-2 flex items-center gap-2">
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
                className="ed-seg__item ed-focus h-8 truncate px-1 text-[0.8125rem] font-semibold tabular-nums"
              >
                {value === 'all' ? t('All') : downloaded.size ? t('Downloaded · {size}', { size: downloaded.size }) : t('Downloaded')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={shuffle}
            className="home-card fx-press ed-focus flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[0.8125rem] font-semibold text-[var(--home-heading)]"
          >
            <Shuffle className="h-[15px] w-[15px]" strokeWidth={2} />
            {t('Shuffle')}</button>
        </div>

        <div className="mt-3">
          {loading ? (
            <ListSkeleton />
          ) : visible.length ? (
            visible.map((chapter, i) => (
              <Fragment key={chapter.id}>
                {i ? <div className="set-row__divider" style={{ marginLeft: 48 }} aria-hidden /> : null}
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
      {/* With a surah playing its player is the one shown; Nature mode stays on the moon at the top. */}
      {listening ? null : <NatureDock onOpen={() => setNatureOpen(true)} />}
      <NowPlayingSheet
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        onOpenSleep={() => setSleepOpen(true)}
        onOpenNature={() => setNatureOpen(true)}
      />
      <NatureSheet
        open={natureOpen}
        onClose={() => setNatureOpen(false)}
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
    <section className="home-card listen-reciter-card mt-4 rounded-[1.25rem] p-4" aria-label={t('Reciting')}>
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={onChoose} className="ed-focus fx-press shrink-0 rounded-full" aria-label={t('Choose a reciter')}>
          <ReciterAvatar key={reciter.id} reciter={reciter} size={76} className="home-fade" />
        </button>
        <button type="button" onClick={onChoose} className="ed-focus min-w-0 flex-1 rounded-lg text-left">
          <span className="block text-[0.8125rem] text-[var(--home-muted)]">{t('Reciting')}</span>
          <span
            key={reciter.id}
            className="home-fade line-clamp-2 text-[1.1875rem] font-bold leading-tight text-[var(--home-heading)]"
          >
            {reciter.name}
          </span>
          <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--home-muted)]">
            {narrations.length > 1 ? reciter.style : `${getQiraat(reciter.qiraat).short} · ${reciter.style}`}
          </span>
        </button>
        <HeartButton reciter={reciter} className="-mr-1 self-start" />
      </div>

      {narrations.length > 1 ? (
        <div className="mt-3.5">
          <div
            ref={rail}
            className="qari-no-scrollbar -mx-4 flex gap-5 overflow-x-auto border-b border-[var(--home-rule)] px-4"
            role="radiogroup"
            aria-label={t('Narration')}
          >
            {narrations.map((variant) => {
              const on = variant.qiraat === reciter.qiraat
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
                    'ed-focus relative shrink-0 whitespace-nowrap pb-2 pt-1 text-[0.875rem] transition-colors',
                    on ? 'font-semibold text-[var(--home-heading)]' : 'font-medium text-[var(--home-muted)]'
                  )}
                >
                  {getQiraat(variant.qiraat).short}
                  <span
                    className={cn(
                      'absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--home-sage)] transition-opacity',
                      on ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden
                  />
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-[0.75rem] text-[var(--home-muted)]">{getQiraat(reciter.qiraat).label}</p>
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
        'flex min-h-[56px] items-center rounded-xl transition-colors duration-300',
        active && 'bg-[color-mix(in_srgb,var(--home-sage)_7%,transparent)]'
      )}
    >
      <button
        type="button"
        onClick={() => onPlay(chapter)}
        disabled={unavailable}
        aria-label={`${playing || loading ? t('Pause') : t('Play')} ${chapter.englishName}`}
        className="ed-focus group flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 pl-1 pr-2 text-left disabled:opacity-45"
      >
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[0.8125rem] font-semibold tabular-nums transition-transform duration-150 group-active:scale-90',
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
          <span className="block text-[0.75rem] text-[var(--home-muted)]">
            {chapter.versesCount} {t('ayahs')}
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
  // The space the first surahs will take, kept empty while they are read (no pulsing shapes).
  return <div className="h-[24rem]" aria-busy aria-label={t('Loading surahs')} />
}
