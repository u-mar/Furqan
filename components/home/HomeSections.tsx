'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, Pause, Play, Settings, Star } from 'lucide-react'
import { HalaqaGlyph, QiblaGlyph } from '@/components/home/HomeGlyphs'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useListenState } from '@/hooks/useListen'
import { useAutoLocate, useNow, usePrayerState } from '@/hooks/usePrayer'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import { getSignedInUser } from '@/lib/auth'
import { tapFeedback } from '@/lib/haptics'
import { getLastListen, playSurah, togglePlay, type LastListen } from '@/lib/listen-player'
import { getChapters } from '@/lib/quran'
import { DAILY_PRAYERS, homeSkyState, type DailyPrayer } from '@/lib/home-sky'
import { PRAYER_NAMES, formatTime, minutesUntil } from '@/lib/prayer'
import { RECITERS, getReciterById, topReciters, type Reciter } from '@/lib/reciters'
import { useLocalReciters } from '@/lib/verified-reciters'
import { tr, useLanguage, useT } from '@/lib/i18n'

function locale(language: string): string {
  return language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en-US'
}

/** "4:41" — the clock without AM/PM, for the five small times. */
function shortTime(date: Date, language: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat(locale(language), { hour: 'numeric', minute: '2-digit', timeZone })
      .formatToParts(date)
      .filter((part) => part.type !== 'dayPeriod')
      .map((part) => part.value)
      .join('')
      .trim()
  } catch {
    return formatTime(date, language, timeZone)
  }
}

/** "Subax (Fajr)" → "Subax": the name alone. */
function prayerName(id: DailyPrayer): string {
  return tr(PRAYER_NAMES[id]).replace(/\s*\(.*\)\s*$/, '')
}

/** "Saturday, November 7" in the app's language. */
function longDate(date: Date, language: string): string {
  try {
    return new Intl.DateTimeFormat(locale(language), { weekday: 'long', month: 'long', day: 'numeric' }).format(date)
  } catch {
    return date.toDateString()
  }
}

/** The signed-in person's first name, or "Guest"; kept current as they sign in and out. */
function useFirstName(): string | null {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => setName(getSignedInUser()?.name.trim().split(/\s+/)[0] ?? '')
    sync()
    window.addEventListener('auth-user-changed', sync)
    return () => window.removeEventListener('auth-user-changed', sync)
  }, [])
  return name
}

/** Today's date, and the salam with the name on one line; Settings on the right. */
export function HomeTopBar() {
  const t = useT()
  const language = useLanguage()
  const clock = useNow(60_000)
  const name = useFirstName()
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="home-date home-date--small truncate">{clock ? longDate(clock, language) : ' '}</p>
        <h1 className="mt-1 truncate text-[1.25rem] font-bold leading-tight tracking-[-0.01em] text-[var(--home-heading)]">
          {t('Assalamu alaikum,')} {name === null ? ' ' : name || t('Guest')}
        </h1>
      </div>
      <Link href="/settings" className="home-outline-round ed-focus h-10 w-10" aria-label={t('Open settings')}>
        <Settings className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden />
      </Link>
    </header>
  )
}

/**
 * One reciter, large, at the top: the one last listened to (or chosen in
 * Listen), and a button that carries on from where it stopped — playing right
 * here, then pausing it — or opens Listen when nothing has been played yet.
 */
export function ListeningHero() {
  const t = useT()
  const router = useRouter()
  const settings = useAppSettings()
  const listen = useListenState()
  const { favoriteIds, ready } = useReciterFavorites()
  const [last, setLast] = useState<LastListen | null>(null)
  const [surahName, setSurahName] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => setLast(getLastListen()), [listen.surah?.id])

  const reciterId = listen.reciterId ?? last?.reciterId ?? settings.listenReciterId
  const reciter = getReciterById(reciterId)
  const surahId = listen.surah?.id ?? (last?.reciterId === reciterId ? last.surahId : null)

  useEffect(() => {
    if (listen.surah) {
      setSurahName(listen.surah.englishName)
      return
    }
    if (!surahId) return
    let cancelled = false
    getChapters()
      .then((chapters) => {
        if (!cancelled) setSurahName(chapters.find((c) => c.id === surahId)?.englishName ?? '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [listen.surah, surahId])

  // Holds its place while the favourites are read, with nothing drawn in it.
  if (!ready) return <div className="h-14" aria-hidden />

  const playing = Boolean(listen.surah) && (listen.status === 'playing' || listen.status === 'loading')
  const busy = starting || listen.status === 'loading'

  const go = async () => {
    tapFeedback()
    if (listen.surah) {
      togglePlay()
      return
    }
    if (!last || last.reciterId !== reciterId) {
      router.push(`/listen?reciter=${encodeURIComponent(reciterId)}`)
      return
    }
    setStarting(true)
    try {
      const chapter = (await getChapters()).find((c) => c.id === last.surahId)
      if (chapter) await playSurah(chapter, last.reciterId, last.position)
      else router.push(`/listen?reciter=${encodeURIComponent(reciterId)}`)
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="flex items-center gap-3" aria-label={t('Continue listening')}>
      <Link href={`/listen?reciter=${encodeURIComponent(reciterId)}`} className="home-press ed-focus shrink-0 rounded-full">
        <ReciterAvatar reciter={reciter} size={56} eager />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.75rem] text-[var(--home-muted)]">
          {favoriteIds.includes(reciterId) ? t('From your favourites') : t('Your reciter')}
        </p>
        <p className="truncate text-[0.9375rem] font-semibold leading-snug text-[var(--home-heading)]">{reciter.name}</p>
        {surahName ? <p className="truncate text-[0.75rem] text-[var(--home-muted)]">{surahName}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => void go()}
        aria-label={playing ? t('Pause') : t('Continue listening')}
        className="fx-press ed-focus inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[0.8125rem] font-semibold text-black"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} aria-hidden />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden />
        ) : (
          <Play className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden />
        )}
        {playing ? t('Pause') : t('Continue')}
      </button>
    </section>
  )
}

/**
 * The next prayer in big type: a small spaced line with how long until it,
 * the prayer and its time large, and the day's other four in one quiet row
 * beneath. Opens all the times.
 */
export function NextPrayerCard() {
  const t = useT()
  const language = useLanguage()
  const { place, settings, ready } = usePrayerState()
  // Home names the next prayer, so it finds where the phone is by itself too.
  useAutoLocate(ready, place)
  const clock = useNow(10_000)
  const state = useMemo(
    () => (ready && clock ? homeSkyState(place, settings, clock) : null),
    [ready, clock, place, settings]
  )

  // Until the times are worked out (a moment), its place is kept, empty.
  if (!state || !clock) return <div className="h-[8.5rem]" aria-hidden />

  const left = minutesUntil(state.next.at, clock)
  const timeLeft = left >= 60 ? t('{h}h {m}m', { h: Math.floor(left / 60), m: left % 60 }) : t('{m}m', { m: left })
  const nextIndex = DAILY_PRAYERS.indexOf(state.next.id)

  return (
    <Link
      href="/prayer"
      className="home-press ed-focus block rounded-2xl px-1"
      aria-label={`${prayerName(state.next.id)} ${formatTime(state.next.at, language, place.timeZone)}, ${t('in {time}', { time: timeLeft })}`}
    >
      <span className="home-date block">
        {t('Next prayer')} · {t('in {time}', { time: timeLeft })}
      </span>
      <span className="mt-1 flex items-baseline gap-3 text-[2.375rem] font-extrabold leading-[1.1] tracking-[-0.02em]">
        <span className="truncate text-[var(--home-heading)]">{prayerName(state.next.id)}</span>
        <span className="shrink-0 tabular-nums text-[var(--home-muted)]">{shortTime(state.next.at, language, place.timeZone)}</span>
      </span>
      <span className="mt-3.5 flex justify-between gap-2 border-t border-[var(--home-rule)] pt-3.5 text-[0.875rem]">
        {DAILY_PRAYERS.map((id, i) => {
          if (i === nextIndex) return null
          // Earlier today: already prayed (all of them still to come once the day rolls over).
          const past = !state.tomorrow && i < nextIndex
          return (
            <span key={id} className={`min-w-0 truncate tabular-nums ${past ? 'opacity-45' : ''}`}>
              <span className="text-[var(--home-muted)]">{prayerName(id)}</span>{' '}
              <span className="font-medium text-[var(--home-heading)]">{shortTime(state.day[id], language, place.timeZone)}</span>
            </span>
          )
        })}
      </span>
    </Link>
  )
}

/** A section's name, with a blue link on the right when there is more to see. */
export function SectionTitle({
  children,
  star,
  more,
}: {
  children: ReactNode
  star?: boolean
  more?: { label: string } & ({ href: string } | { onClick: () => void })
}) {
  const moreClass = 'ed-focus shrink-0 rounded-md text-[0.8125rem] font-medium text-[var(--home-sage)]'
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-1.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-[var(--home-heading)]">
        {star ? <Star className="home-star h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden /> : null}
        {children}
      </h2>
      {more ? (
        'href' in more ? (
          <Link href={more.href} className={moreClass}>
            {more.label}
          </Link>
        ) : (
          <button type="button" onClick={more.onClick} className={moreClass}>
            {more.label}
          </button>
        )
      ) : null}
    </div>
  )
}

/** A shortcut tile: its name at the top, its picture tucked into the bottom corner. */
function Shortcut({ href, picture, label }: { href: string; picture: ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="home-press ed-focus relative block h-[4.75rem] overflow-hidden rounded-2xl bg-[var(--home-card-bg)] px-2.5 py-2"
    >
      <span className="relative z-[1] block text-[0.8125rem] font-medium leading-tight text-[var(--home-heading)]">{label}</span>
      <span className="pointer-events-none absolute bottom-0 end-0 flex items-end justify-end" aria-hidden>
        {picture}
      </span>
    </Link>
  )
}

/** Qibla, the prayer times and Halaqa, each a tile with its own picture. */
export function QuickAccess() {
  const t = useT()
  return (
    <section aria-label={t('Quick access')}>
      <SectionTitle star>{t('Quick access')}</SectionTitle>
      <nav className="grid grid-cols-3 gap-2">
        <Shortcut
          href="/prayer/qibla"
          picture={<QiblaGlyph className="-mb-3 -me-3 h-[3.75rem] w-[3.75rem]" />}
          label={t('Qibla')}
        />
        <Shortcut
          href="/prayer"
          picture={<img src="/icons/prayer-dua.png" alt="" className="-mb-1 -me-0.5 h-[3.25rem] w-[3.25rem]" draggable={false} />}
          label={t('Prayer times')}
        />
        <Shortcut href="/halaqa" picture={<HalaqaGlyph className="mb-1.5 me-1.5 h-10 w-10" />} label={t('Halaqa')} />
      </nav>
    </section>
  )
}

/**
 * Your three latest favourite sheikhs, the well-known reciters and the verified local qaris mixed;
 * each opens Listen with them reciting.
 */
export function FavouriteSheikhs() {
  const t = useT()
  const { favoriteIds, ready } = useReciterFavorites()
  const locals = useLocalReciters()
  const sheikhs = useMemo(() => {
    // Newest first, as they are kept.
    const favourites = favoriteIds
      .map((id) => RECITERS.find((r) => r.id === id) ?? locals.reciters.find((r) => r.id === id))
      .filter((r): r is Reciter => Boolean(r))
    return (favourites.length ? favourites : topReciters()).slice(0, 3)
  }, [favoriteIds, locals])

  return (
    <section aria-label={t('Your favourites')}>
      <SectionTitle star more={{ href: '/listen?reciters=1', label: t('See all') }}>
        {t('Your favourites')}
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {ready
          ? sheikhs.map((reciter) => (
              <Link
                key={reciter.id}
                href={`/listen?reciter=${encodeURIComponent(reciter.id)}`}
                className="home-press ed-focus flex flex-col items-center gap-1.5 rounded-2xl text-center"
              >
                <ReciterAvatar reciter={reciter} size={60} />
                <span className="line-clamp-2 text-[0.75rem] font-medium leading-snug text-[var(--home-heading)]">{reciter.name}</span>
              </Link>
            ))
          : Array.from({ length: 3 }, (_, i) => (
              <span key={i} className="mx-auto h-[3.75rem] w-[3.75rem] rounded-full bg-[var(--home-card-bg)]" aria-hidden />
            ))}
      </div>
    </section>
  )
}
