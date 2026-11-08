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

/** Today's date, the salam and the name, large; Settings on the right. */
export function HomeTopBar() {
  const t = useT()
  const language = useLanguage()
  const clock = useNow(60_000)
  const name = useFirstName()
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="home-date truncate">{clock ? longDate(clock, language) : ' '}</p>
        <p className="mt-1.5 text-[1.125rem] font-medium text-[var(--home-muted)]">{t('Assalamu alaikum,')}</p>
        <h1 className="mt-0.5 truncate text-[2.5rem] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--home-heading)]">
          {name === null ? ' ' : name || t('Guest')}
        </h1>
      </div>
      <Link href="/settings" className="home-outline-round ed-focus mt-1 h-12 w-12" aria-label={t('Open settings')}>
        <Settings className="h-[21px] w-[21px]" strokeWidth={1.9} aria-hidden />
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

  if (!ready) return <div className="h-[8.5rem] animate-pulse rounded-[1.375rem] bg-[var(--home-card-bg)]" aria-hidden />

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
    <section className="flex items-center gap-4" aria-label={t('Continue listening')}>
      <Link href={`/listen?reciter=${encodeURIComponent(reciterId)}`} className="home-press ed-focus shrink-0 rounded-full">
        <ReciterAvatar reciter={reciter} size={128} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] text-[var(--home-muted)]">
          {favoriteIds.includes(reciterId) ? t('From your favourites') : t('Your reciter')}
        </p>
        <p className="line-clamp-2 text-[1.375rem] font-bold leading-tight tracking-[-0.01em] text-[var(--home-heading)]">{reciter.name}</p>
        {surahName ? <p className="mt-0.5 truncate text-[0.875rem] text-[var(--home-muted)]">{surahName}</p> : null}
        <button
          type="button"
          onClick={() => void go()}
          className="fx-press ed-focus mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[0.9375rem] font-semibold text-black"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.4} aria-hidden />
          ) : playing ? (
            <Pause className="h-4 w-4 fill-current" strokeWidth={0} aria-hidden />
          ) : (
            <Play className="h-4 w-4 fill-current" strokeWidth={0} aria-hidden />
          )}
          {playing ? t('Pause') : t('Continue listening')}
        </button>
      </div>
    </section>
  )
}

/**
 * The next prayer in big type, like the date and name at the top: a small
 * spaced line with how long until it, the prayer and its time large, and the
 * day's other four in one quiet row beneath. Opens all the times.
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

  if (!state || !clock) return <div className="h-[8.5rem] animate-pulse rounded-2xl bg-[var(--home-card-bg)]" aria-hidden />

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
      <span className="mt-1 flex items-baseline gap-3 text-[2.75rem] font-extrabold leading-[1.1] tracking-[-0.02em]">
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
function SectionTitle({ children, star, more }: { children: ReactNode; star?: boolean; more?: { href: string; label: string } }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="flex items-center gap-2 text-[1.3125rem] font-bold tracking-[-0.01em] text-[var(--home-heading)]">
        {star ? <Star className="home-star h-[1.125rem] w-[1.125rem] fill-current" strokeWidth={0} aria-hidden /> : null}
        {children}
      </h2>
      {more ? (
        <Link href={more.href} className="ed-focus shrink-0 rounded-md text-[0.9375rem] font-medium text-[var(--home-sage)]">
          {more.label}
        </Link>
      ) : null}
    </div>
  )
}

/** A round shortcut with its name below. `filled`: the picture is the whole circle (the qibla dial). */
function Shortcut({ href, picture, label, filled }: { href: string; picture: ReactNode; label: string; filled?: boolean }) {
  return (
    <Link href={href} className="home-press ed-focus flex w-[5.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl text-center">
      <span className={`flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full ${filled ? '' : 'bg-[var(--home-card-bg)]'}`}>
        {picture}
      </span>
      <span className="text-[0.9375rem] font-medium leading-tight text-[var(--home-heading)]">{label}</span>
    </Link>
  )
}

/** Qibla, the prayer times and Halaqa, each with its own picture. */
export function QuickAccess() {
  const t = useT()
  return (
    <section aria-label={t('Quick access')}>
      <SectionTitle star>{t('Quick access')}</SectionTitle>
      <nav className="flex justify-between gap-3 px-1">
        <Shortcut href="/prayer/qibla" picture={<QiblaGlyph className="h-full w-full" />} label={t('Qibla')} filled />
        <Shortcut
          href="/prayer"
          picture={<img src="/icons/prayer-dua.png" alt="" className="h-[4.25rem] w-[4.25rem]" draggable={false} />}
          label={t('Prayer times')}
        />
        <Shortcut href="/halaqa" picture={<HalaqaGlyph className="h-11 w-11" />} label={t('Halaqa')} />
      </nav>
    </section>
  )
}

/** Three of your favourite sheikhs; each opens Listen with them reciting. */
export function FavouriteSheikhs() {
  const t = useT()
  const { favoriteIds, ready } = useReciterFavorites()
  const sheikhs = useMemo(() => {
    const favourites = favoriteIds.map((id) => RECITERS.find((r) => r.id === id)).filter((r): r is Reciter => Boolean(r))
    return (favourites.length ? favourites : topReciters()).slice(0, 3)
  }, [favoriteIds])

  return (
    <section aria-label={t('Your favourites')}>
      <SectionTitle star more={{ href: '/listen?reciters=1', label: t('See all') }}>
        {t('Your favourites')}
      </SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {ready
          ? sheikhs.map((reciter) => (
              <Link
                key={reciter.id}
                href={`/listen?reciter=${encodeURIComponent(reciter.id)}`}
                className="home-press ed-focus flex flex-col items-center gap-2 rounded-2xl text-center"
              >
                <ReciterAvatar reciter={reciter} size={104} />
                <span className="line-clamp-2 text-[0.9375rem] font-medium leading-snug text-[var(--home-heading)]">{reciter.name}</span>
              </Link>
            ))
          : Array.from({ length: 3 }, (_, i) => (
              <span key={i} className="mx-auto h-[6.5rem] w-[6.5rem] animate-pulse rounded-full bg-[var(--home-card-bg)]" aria-hidden />
            ))}
      </div>
    </section>
  )
}
