'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Compass,
  MapPin,
  Moon,
  MoonStar,
  Settings2,
  Sun,
  Sunrise,
  Sunset,
  type LucideIcon,
} from 'lucide-react'
import LocationOffNote from '@/components/prayer/LocationOffNote'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import Switch from '@/components/qari/Switch'
import { useAutoLocate, useNow, usePrayerState } from '@/hooks/usePrayer'
import { adhanAvailable } from '@/lib/adhan-audio'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { formatHijri } from '@/lib/hijri'
import {
  ADHAN_PRAYERS,
  METHODS,
  PRAYER_NAMES,
  PRAYER_ORDER,
  currentPrayer,
  formatCountdown,
  formatTime,
  minutesUntil,
  nextPrayer,
  prayerTimesFor,
  prayerWaitProgress,
  qiblaBearing,
  savePrayerSettings,
  type MethodId,
  type PrayerId,
} from '@/lib/prayer'
import { tapFeedback } from '@/lib/haptics'
import { tr, useLanguage, useT } from '@/lib/i18n'

/** Each prayer's icon — plain outline, one colour, not a small illustration. */
const PRAYER_ICONS: Record<PrayerId, LucideIcon> = {
  fajr: Moon,
  sunrise: Sunrise,
  dhuhr: Sun,
  asr: CloudSun,
  maghrib: Sunset,
  isha: MoonStar,
}

/** Shown beside the name in the app's other languages; in Arabic the name already is this. */
const PRAYER_NAMES_AR: Record<PrayerId, string> = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
}

const DAY_MS = 24 * 3600 * 1000

/** "Subax (Fajr)" → "Subax": the name alone, where the Arabic name stands beside it. */
function prayerName(id: PrayerId): string {
  return tr(PRAYER_NAMES[id]).replace(/\s*\(.*\)\s*$/, '')
}

type Sheet = 'method' | null

/**
 * The day's prayer times — reached from its own tile on Home, and from the
 * next-prayer card above that tile. At the top, the prayer that comes next and
 * how long until it; below it, the day, where each prayer's adhan is a bell to
 * tap; then the qibla, and how the times are worked out. Plain cards in the
 * app's own colours, so the times are what stands out.
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

  const location = useAutoLocate(ready, place)

  useEffect(() => {
    void adhanAvailable().then(setHasAdhan)
  }, [])

  // The day's times only change when the day does, not every second.
  const dayKey = now.toDateString()
  const times = useMemo(() => prayerTimesFor(place, new Date(), settings), [place, settings, dayKey])
  const lastNightIsha = useMemo(
    () => prayerTimesFor(place, new Date(Date.now() - DAY_MS), settings).isha,
    [place, settings, dayKey]
  )
  const next = nextPrayer(place, settings, now)
  const current = currentPrayer(times, now)
  const tz = place.timeZone
  const show = (d: Date) => formatTime(d, language, tz)
  const minutesLeft = minutesUntil(next.at, now)
  // Under an hour, the seconds count down too.
  const timeLeft =
    minutesLeft >= 60
      ? t('{h}h {m}m', { h: Math.floor(minutesLeft / 60), m: minutesLeft % 60 })
      : formatCountdown(next.at.getTime() - now.getTime())

  if (!mounted) {
    return (
      <main className="min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
        <div className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <PrayerHeader title={t('Prayer times')} />
        </div>
      </main>
    )
  }

  const setAdhanFor = (id: PrayerId, on: boolean) => {
    if (id === 'sunrise') return
    tapFeedback()
    if (on && !settings.adhan) savePrayerSettings({ adhan: true, adhanFor: { ...settings.adhanFor, [id]: true } })
    else savePrayerSettings({ adhanFor: { ...settings.adhanFor, [id]: on } })
  }

  // The wait for the next prayer, from the one before it (last night's Isha, before Fajr).
  const waited = prayerWaitProgress(place, settings, times, current, next, now)
  const since = current ? { id: current, at: times[current] } : { id: 'isha' as PrayerId, at: lastNightIsha }
  const placeName = place.name || (place.source === 'device' ? t('Your location') : 'Mogadishu')
  const gregorian = new Intl.DateTimeFormat(language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
  const qibla = Math.round(qiblaBearing(place))

  return (
    <main className="prayer-page min-h-[100dvh] bg-[var(--app-bg)] text-[var(--app-text)]">
      <div
        className="mx-auto w-full max-w-lg px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        style={{ paddingBottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1.5rem)` }}
      >
        <PrayerHeader title={t('Prayer times')} subtitle={`${gregorian} · ${formatHijri(now)}`} />

        <LocationOffNote status={location.status} place={place} onRetry={location.retry} />

        {/* What comes next */}
        <section className="pt-next mt-4" aria-labelledby="pt-next">
          <div className="flex items-center justify-between gap-3">
            <p className="pt-next__kicker">{t('Next prayer')}</p>
            <span className="pt-next__place">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
              <span className="truncate">{placeName}</span>
            </span>
          </div>

          <div className="mt-2.5 flex items-end justify-between gap-3">
            <h2 id="pt-next" className="pt-next__name">
              {prayerName(next.id)}
            </h2>
            {language !== 'ar' ? (
              <span className="pt-next__arabic" lang="ar" dir="rtl">
                {PRAYER_NAMES_AR[next.id]}
              </span>
            ) : null}
          </div>

          <p className="pt-next__meta">
            <span>{show(next.at)}</span>
            <span className="pt-next__left">{t('in {time}', { time: timeLeft })}</span>
          </p>

          <div
            className="pt-next__track"
            role="progressbar"
            aria-label={t('Next prayer')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(waited * 100)}
          >
            <span style={{ width: `${(waited * 100).toFixed(2)}%` }} />
          </div>
          <div className="pt-next__ends">
            <span>
              {prayerName(since.id)} · {show(since.at)}
            </span>
            <span>
              {prayerName(next.id)} · {show(next.at)}
            </span>
          </div>
        </section>

        {/* The day */}
        <section className="pt-day mt-4" aria-labelledby="pt-today">
          <div className="pt-day__head">
            <h2 id="pt-today" className="pt-day__label">
              {t('Today')}
            </h2>
            {hasAdhan ? (
              <label className="pt-day__adhan">
                <span>{t('Adhan')}</span>
                <Switch checked={settings.adhan} onChange={(on) => savePrayerSettings({ adhan: on })} label={t('Turn on adhan')} />
              </label>
            ) : null}
          </div>
          <ol className="pt-day__list">
            {PRAYER_ORDER.map((id, i) => {
              const state =
                current === id ? 'now' : next.id === id && next.at.toDateString() === now.toDateString() ? 'next' : current && i < PRAYER_ORDER.indexOf(current) ? 'past' : 'later'
              const PrayerIcon = PRAYER_ICONS[id]
              const bell = ADHAN_PRAYERS.includes(id) && hasAdhan
              const ringing = bell && settings.adhan && settings.adhanFor[id as Exclude<PrayerId, 'sunrise'>]
              return (
                <li key={id} className="pt-row" data-state={state}>
                  <span className="pt-row__icon" aria-hidden>
                    <PrayerIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="pt-row__name">
                      <span className="truncate">{prayerName(id)}</span>
                      {state === 'now' ? <span className="pt-row__tag">{t('Now')}</span> : null}
                    </span>
                    {state === 'next' ? (
                      <span className="pt-row__sub">{t('in {time}', { time: timeLeft })}</span>
                    ) : language !== 'ar' ? (
                      <span className="pt-row__sub pt-row__sub--ar" lang="ar" dir="rtl">
                        {PRAYER_NAMES_AR[id]}
                      </span>
                    ) : null}
                  </span>
                  <span className="pt-row__time">{show(times[id])}</span>
                  {bell ? (
                    <button
                      type="button"
                      className="pt-bell ed-focus"
                      aria-pressed={ringing}
                      aria-label={t('Adhan for {prayer}', { prayer: prayerName(id) })}
                      onClick={() => setAdhanFor(id, !ringing)}
                    >
                      {ringing ? (
                        <Bell className="h-[17px] w-[17px]" strokeWidth={2} />
                      ) : (
                        <BellOff className="h-[17px] w-[17px]" strokeWidth={1.8} />
                      )}
                    </button>
                  ) : hasAdhan ? (
                    <span className="pt-bell pt-bell--none" aria-hidden />
                  ) : null}
                </li>
              )
            })}
          </ol>
        </section>
        {hasAdhan ? (
          <p className="mx-2 mt-2.5 text-[0.75rem] leading-snug text-[var(--home-muted)]">
            {t('Plays at each prayer while the app is open.')}
          </p>
        ) : (
          <p className="mx-2 mt-2.5 text-[0.75rem] leading-snug text-[var(--home-muted)]">{t('Adhan sound is coming soon.')}</p>
        )}

        {/* Qibla */}
        <Link href="/prayer/qibla" className="pt-qibla ed-focus mt-4">
          <span className="pt-qibla__dial" aria-hidden>
            <Compass className="h-[22px] w-[22px]" strokeWidth={1.7} style={{ transform: `rotate(${qibla - 45}deg)` }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-[var(--home-heading)]">{t('Qibla')}</span>
            <span className="block text-[0.8125rem] text-[var(--home-muted)]">
              {t('The Kaaba is {degrees}° from north', { degrees: qibla })}
            </span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)] rtl:rotate-180" strokeWidth={2} aria-hidden />
        </Link>

        {/* How the times are worked out */}
        <h2 className="home-label mx-1 mb-2 mt-6">{t('How it is worked out')}</h2>
        <div className="home-card overflow-hidden rounded-2xl">
          <button type="button" className="set-row" onClick={() => setSheet('method')}>
            <span className="set-row__icon" aria-hidden>
              <Settings2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
            </span>
            <span className="set-row__label">{t('Method')}</span>
            <span className="set-row__value">{METHODS.find((m) => m.id === settings.method)?.label}</span>
            <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)] rtl:rotate-180" strokeWidth={2} />
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
      </div>

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

function PrayerHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useT()
  return (
    <header className="flex items-center gap-3">
      <Link href="/" className="home-round ed-focus shrink-0" aria-label={t('Back')}>
        <ChevronLeft className="h-5 w-5 rtl:rotate-180" strokeWidth={1.9} />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="home-serif truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
          {title}
        </h1>
        {subtitle ? <p className="truncate text-[0.8125rem] text-[var(--home-muted)]">{subtitle}</p> : null}
      </div>
    </header>
  )
}
