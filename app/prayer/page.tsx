'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, MapPin, Settings2, Volume2 } from 'lucide-react'
import PlaceSheet from '@/components/prayer/PlaceSheet'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import Switch from '@/components/qari/Switch'
import { useAutoLocate, useNow, usePrayerState } from '@/hooks/usePrayer'
import { adhanAvailable } from '@/lib/adhan-audio'
import { formatHijri } from '@/lib/hijri'
import {
  ADHAN_PRAYERS,
  METHODS,
  PRAYER_NAMES,
  PRAYER_ORDER,
  currentPrayer,
  formatTime,
  minutesUntil,
  nextPrayer,
  prayerTimesFor,
  prayerWaitProgress,
  savePrayerSettings,
  type MethodId,
  type PrayerId,
} from '@/lib/prayer'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { useLanguage, useT } from '@/lib/i18n'

/** Each prayer's picture, from the Noto emoji set in /public/icons/noto. */
const PRAYER_ICONS: Record<PrayerId, string> = {
  fajr: 'milky-way',
  sunrise: 'sunrise',
  dhuhr: 'sun',
  asr: 'sun-behind-cloud',
  maghrib: 'sunset',
  isha: 'crescent-moon',
}

const RING_R = 40
const RING_LENGTH = 2 * Math.PI * RING_R

type Sheet = 'place' | 'method' | null

/**
 * Just the day's prayer times — reached from its own tile on Home, and from
 * the next-prayer card above that tile. Qibla used to share this screen
 * behind a tab; now it is its own focused screen instead.
 */
export default function PrayerPage() {
  const t = useT()
  const language = useLanguage()
  const { place, settings, ready } = usePrayerState()
  const clock = useNow(1000)
  const mounted = clock !== null
  const now = clock ?? new Date(0)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [hasAdhan, setHasAdhan] = useState(false)

  useAutoLocate(ready, place)

  useEffect(() => {
    void adhanAvailable().then(setHasAdhan)
  }, [])

  // The day's times only change when the day does, not every second.
  const dayKey = now.toDateString()
  const times = useMemo(() => prayerTimesFor(place, new Date(), settings), [place, settings, dayKey])
  const next = nextPrayer(place, settings, now)
  const current = currentPrayer(times, now)
  const currentIndex = current ? PRAYER_ORDER.indexOf(current) : -1
  const tz = place.timeZone
  const show = (d: Date) => formatTime(d, language, tz)
  const placeLabel = place.name ? place.name : t('Your location')
  const waited = prayerWaitProgress(place, settings, times, current, next, now)
  const minutesLeft = minutesUntil(next.at, now)
  const timeLeft =
    minutesLeft >= 60
      ? t('{h}h {m}m', { h: Math.floor(minutesLeft / 60), m: minutesLeft % 60 })
      : t('{m}m', { m: minutesLeft })

  if (!mounted) {
    return (
      <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
        <div className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <header className="flex items-center gap-3">
            <Link href="/" className="home-round ed-focus" aria-label={t('Back')}>
              <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
            </Link>
            <h1 className="home-serif text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
              {t('Prayer')}
            </h1>
          </header>
        </div>
      </main>
    )
  }

  const setAdhanFor = (id: PrayerId, on: boolean) => {
    if (id === 'sunrise') return
    savePrayerSettings({ adhanFor: { ...settings.adhanFor, [id]: on } })
  }

  return (
    <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3">
          <Link href="/" className="home-round ed-focus" aria-label={t('Back')}>
            <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="home-serif truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
              {t('Prayer')}
            </h1>
            <p className="truncate text-[0.8125rem] text-[var(--home-muted)]">{formatHijri(now)}</p>
          </div>
          <button type="button" onClick={() => setSheet('place')} className="prayer-pill home-press ed-focus" aria-label={t('Your location')}>
            <MapPin className="h-4 w-4 shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2} />
            <span className="truncate">{placeLabel}</span>
          </button>
        </header>

        {place.source === 'default' ? (
          <button
            type="button"
            onClick={() => setSheet('place')}
            className="ed-focus mx-1 mt-3 block w-full text-left text-[0.8125rem] text-[var(--home-muted)] underline decoration-[var(--home-rule-strong)] underline-offset-2"
          >
            {t('Using Mogadishu. Tap to use your own location.')}
          </button>
        ) : null}

        {hasAdhan ? (
          <div className="home-card mt-4 overflow-hidden rounded-2xl">
            <div className="set-row">
              <span className="set-row__icon" aria-hidden>
                <Volume2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{t('Turn on adhan')}</span>
                <span className="block text-[0.78125rem] text-[var(--home-muted)]">
                  {t('Plays at each prayer while the app is open.')}
                </span>
              </span>
              <Switch checked={settings.adhan} onChange={(on) => savePrayerSettings({ adhan: on })} label={t('Turn on adhan')} />
            </div>
          </div>
        ) : null}

        {/* What comes next */}
        <section className="prayer-hero mt-3.5 flex items-center gap-4 px-5 py-6" aria-live="polite">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] opacity-65">{t('Next prayer')}</p>
            <p className="home-serif mt-1.5 truncate text-[2.1875rem] font-semibold leading-none tracking-[-0.02em]">
              {t(PRAYER_NAMES[next.id])}
            </p>
            <p className="mt-2 text-[1.0625rem] font-medium tabular-nums opacity-80">
              {t('Time: {time}', { time: show(next.at) })}
            </p>
          </div>
          <div className="relative h-[6rem] w-[6rem] shrink-0">
            <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="prayer-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#c9d92e" />
                  <stop offset="1" stopColor="#1fb56a" />
                </linearGradient>
              </defs>
              <circle cx="48" cy="48" r={RING_R} fill="none" strokeWidth="9" className="prayer-hero__ring-track" />
              <circle
                cx="48"
                cy="48"
                r={RING_R}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - waited)}
                className="prayer-hero__ring-bar"
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
              <span className="text-[0.9375rem] font-bold tabular-nums">{timeLeft}</span>
              <span className="text-[0.6875rem] opacity-65">{t('left')}</span>
            </span>
          </div>
        </section>

        {/* The day */}
        <div className="home-card mt-3.5 overflow-hidden rounded-2xl">
          {PRAYER_ORDER.map((id, i) => {
            const active = current === id
            const past = currentIndex >= 0 && i < currentIndex
            const withAdhan = ADHAN_PRAYERS.includes(id) && hasAdhan
            return (
              <div key={id}>
                {i > 0 ? <div className="set-row__divider" aria-hidden /> : null}
                <div className={cn('prayer-row', active && 'prayer-row--now', past && 'prayer-row--past')}>
                  <span className={cn('prayer-chip', `prayer-chip--${id}`)} aria-hidden>
                    <img src={`/icons/noto/${PRAYER_ICONS[id]}.svg`} alt="" className="h-[1.625rem] w-[1.625rem]" draggable={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[0.9375rem] font-semibold text-[var(--home-heading)]">
                      {t(PRAYER_NAMES[id])}
                      {active ? (
                        <span className="rounded-full bg-[var(--home-sage)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--home-ink-fg)]">
                          {t('Now')}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-[0.8125rem] tabular-nums text-[var(--home-muted)]">{show(times[id])}</span>
                  </span>
                  {withAdhan ? (
                    <Switch
                      checked={settings.adhan && settings.adhanFor[id as Exclude<PrayerId, 'sunrise'>]}
                      onChange={(on) => {
                        if (on && !settings.adhan) savePrayerSettings({ adhan: true })
                        setAdhanFor(id, on)
                      }}
                      label={t('Adhan for {prayer}', { prayer: t(PRAYER_NAMES[id]) })}
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <h2 className="home-label mx-1 mb-2 mt-[22px]">{t('How it is worked out')}</h2>
        <div className="home-card overflow-hidden rounded-2xl">
          <button type="button" className="set-row" onClick={() => setSheet('method')}>
            <span className="set-row__icon" aria-hidden>
              <Settings2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="set-row__label">{t('Method')}</span>
            <span className="set-row__value">{METHODS.find((m) => m.id === settings.method)?.label}</span>
            <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
          </button>
          <div className="set-row__divider" aria-hidden />
          <div className="px-3.5 py-3">
            <p className="mb-2 text-xs font-semibold text-[var(--home-heading)]">{t('Asr')}</p>
            <div className="ed-seg grid-cols-2">
              {(
                [
                  ['shafi', t('Standard (Shafi‘i, Maliki, Hanbali)')],
                  ['hanafi', t('Hanafi')],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => savePrayerSettings({ madhab: id })}
                  aria-pressed={settings.madhab === id}
                  className="ed-seg__item ed-focus flex min-h-[44px] items-center justify-center px-2 text-center text-[0.8125rem] font-semibold leading-tight"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {!hasAdhan ? (
          <p className="mx-1 mt-4 text-center text-xs text-[var(--home-muted)]">
            {t('Adhan sound is coming soon.')}
          </p>
        ) : null}
      </div>

      <PlaceSheet open={sheet === 'place'} place={place} onClose={() => setSheet(null)} />

      {/* Method */}
      <SettingsSheet
        open={sheet === 'method'}
        title={t('Method')}
        description={t('Countries and authorities differ on the angle of the sun for Fajr and Isha. Pick the one your community follows.')}
        onClose={() => setSheet(null)}
      >
        <div className="divide-y divide-[var(--home-rule)] overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup">
          {METHODS.map((m) => {
            const on = settings.method === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  tapFeedback()
                  savePrayerSettings({ method: m.id as MethodId })
                  setSheet(null)
                }}
                className="set-row"
              >
                <span className="set-row__label">{m.label}</span>
                <Radio on={on} />
              </button>
            )
          })}
        </div>
      </SettingsSheet>
    </main>
  )
}
