'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Compass, LocateFixed, MapPin, Play, Settings2, Square, Volume2 } from 'lucide-react'
import QiblaCompass from '@/components/prayer/QiblaCompass'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import Switch from '@/components/qari/Switch'
import { useAdhanPlaying, useNow, usePrayerState } from '@/hooks/usePrayer'
import { adhanAvailable, playAdhan, stopAdhan } from '@/lib/adhan-audio'
import { formatHijri } from '@/lib/hijri'
import { tapFeedback } from '@/lib/haptics'
import {
  ADHAN_PRAYERS,
  CITIES,
  METHODS,
  PRAYER_NAMES,
  PRAYER_ORDER,
  currentPrayer,
  formatCountdown,
  formatTime,
  locateDevice,
  nextPrayer,
  prayerTimesFor,
  savePlace,
  savePrayerSettings,
  type MethodId,
  type Place,
  type PrayerId,
} from '@/lib/prayer'
import { cn } from '@/lib/cn'
import { toastError } from '@/lib/toast'
import { tr, useLanguage, useT } from '@/lib/i18n'

type Tab = 'times' | 'qibla'
type Sheet = 'place' | 'method' | null

export default function PrayerPage() {
  const t = useT()
  const language = useLanguage()
  const { place, settings, ready } = usePrayerState()
  const clock = useNow(1000)
  const mounted = clock !== null
  const now = clock ?? new Date(0)
  const adhanPlaying = useAdhanPlaying()
  const [tab, setTab] = useState<Tab>('times')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [locating, setLocating] = useState(false)
  const [hasAdhan, setHasAdhan] = useState(false)

  useEffect(() => {
    void adhanAvailable().then(setHasAdhan)
  }, [])

  const findMe = useCallback(async () => {
    setLocating(true)
    try {
      savePlace(await locateDevice())
      setSheet(null)
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'failed'
      toastError(
        reason === 'denied'
          ? tr('Location is off for this app. Pick your city instead, or allow location in your phone’s settings.')
          : tr('Could not find your location. Pick your city instead.')
      )
    } finally {
      setLocating(false)
    }
  }, [])

  // If the phone has already been allowed to share its position, use it without asking again.
  useEffect(() => {
    if (!ready || place.source !== 'default') return
    const permissions = navigator.permissions
    if (!permissions?.query) return
    void permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (status.state === 'granted') void findMe()
      })
      .catch(() => {})
  }, [ready, place.source, findMe])

  // The day's times only change when the day does, not every second.
  const dayKey = now.toDateString()
  const times = useMemo(() => prayerTimesFor(place, new Date(), settings), [place, settings, dayKey])
  const next = nextPrayer(place, settings, now)
  const current = currentPrayer(times, now)
  const tz = place.timeZone
  const show = (d: Date) => formatTime(d, language, tz)
  const placeLabel = place.name ? place.name : t('Your location')

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
        </header>

        <div className="ed-seg mt-[18px] grid-cols-2" role="tablist" aria-label={t('Prayer')}>
          {(
            [
              ['times', t('Times')],
              ['qibla', t('Qibla')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-pressed={tab === id}
              onClick={() => {
                tapFeedback()
                setTab(id)
              }}
              className="ed-seg__item ed-focus flex min-h-[44px] items-center justify-center gap-2 text-sm font-semibold"
            >
              {id === 'qibla' ? <Compass className="h-4 w-4" strokeWidth={2} /> : null}
              {label}
            </button>
          ))}
        </div>

        {/* Where these times are for */}
        <button
          type="button"
          onClick={() => setSheet('place')}
          className="home-card home-press ed-focus mt-3.5 flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
        >
          <span className="set-row__icon" aria-hidden>
            <MapPin className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">{placeLabel}</span>
            <span className="block truncate text-[0.78125rem] text-[var(--home-muted)]">
              {place.source === 'default' ? t('Using Mogadishu. Tap to use your own location.') : t('Tap to change')}
            </span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
        </button>

        {tab === 'times' ? (
          <>
            {/* What comes next */}
            <section className="home-card mt-3.5 rounded-[18px] px-5 py-5 text-center" aria-live="polite">
              <p className="home-label">{t('Next prayer')}</p>
              <p className="home-serif mt-2 text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-[var(--home-heading)]">
                {t(PRAYER_NAMES[next.id])}
              </p>
              <p className="mt-1.5 text-[1.0625rem] tabular-nums text-[var(--home-muted)]">{show(next.at)}</p>
              <p className="mt-4 text-[1.75rem] font-semibold tabular-nums text-[var(--home-sage-deep)] dark:text-[var(--home-sage)]">
                {formatCountdown(next.at.getTime() - now.getTime())}
              </p>
            </section>

            {/* The day */}
            <div className="home-card mt-3.5 overflow-hidden rounded-2xl">
              {PRAYER_ORDER.map((id, i) => {
                const active = current === id
                const withAdhan = ADHAN_PRAYERS.includes(id) && hasAdhan
                return (
                  <div key={id}>
                    {i > 0 ? <div className="set-row__divider" aria-hidden /> : null}
                    <div className={cn('set-row', active && 'bg-[var(--home-sage-soft)]')}>
                      <span className="set-row__label flex items-center gap-2">
                        {t(PRAYER_NAMES[id])}
                        {active ? (
                          <span className="rounded-full bg-[var(--home-sage)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--home-ink-fg)]">
                            {t('Now')}
                          </span>
                        ) : null}
                      </span>
                      <span className="set-row__value tabular-nums">{show(times[id])}</span>
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

            {hasAdhan ? (
              <div className="home-card mt-3.5 overflow-hidden rounded-2xl">
                <div className="set-row">
                  <span className="set-row__icon" aria-hidden>
                    <Volume2 className="h-[17px] w-[17px]" strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9375rem] font-medium">{t('Sound the adhan')}</span>
                    <span className="block text-[0.78125rem] text-[var(--home-muted)]">
                      {t('Plays at each prayer while the app is open.')}
                    </span>
                  </span>
                  <Switch checked={settings.adhan} onChange={(on) => savePrayerSettings({ adhan: on })} label={t('Sound the adhan')} />
                </div>
                <div className="set-row__divider" aria-hidden />
                <button
                  type="button"
                  className="set-row"
                  onClick={() => {
                    tapFeedback()
                    if (adhanPlaying) stopAdhan()
                    else void playAdhan()
                  }}
                >
                  <span className="set-row__icon set-row__icon--neutral" aria-hidden>
                    {adhanPlaying ? (
                      <Square className="h-[14px] w-[14px] fill-current" strokeWidth={0} />
                    ) : (
                      <Play className="h-[14px] w-[14px] fill-current" strokeWidth={0} />
                    )}
                  </span>
                  <span className="set-row__label">{adhanPlaying ? t('Stop') : t('Hear the adhan')}</span>
                </button>
              </div>
            ) : null}

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
          </>
        ) : (
          <div className="home-card mt-3.5 rounded-[18px] px-4 py-6">
            <QiblaCompass place={place} />
          </div>
        )}
      </div>

      {/* Place */}
      <SettingsSheet
        open={sheet === 'place'}
        title={t('Your location')}
        description={t('Prayer times and the qibla are worked out from where you are.')}
        onClose={() => setSheet(null)}
      >
        <button
          type="button"
          onClick={() => void findMe()}
          disabled={locating}
          className="ed-ink ed-focus qari-press flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" strokeWidth={2} />
          {locating ? t('Finding you…') : t('Use my location')}
        </button>
        <p className="mb-2 mt-5 text-xs font-semibold text-[var(--home-heading)]">{t('Or choose a city')}</p>
        <div className="max-h-[42vh] divide-y divide-[var(--home-rule)] overflow-y-auto rounded-2xl border border-[var(--home-rule)]">
          {CITIES.map((city: Place) => {
            const on = place.source === 'city' && place.name === city.name
            return (
              <button
                key={city.name}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  tapFeedback()
                  savePlace(city)
                  setSheet(null)
                }}
                className="set-row"
              >
                <span className="set-row__label">{t(city.name)}</span>
                <Radio on={on} />
              </button>
            )
          })}
        </div>
      </SettingsSheet>

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
