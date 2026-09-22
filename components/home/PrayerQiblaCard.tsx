'use client'

import Link from 'next/link'
import { useNow, usePrayerState } from '@/hooks/usePrayer'
import {
  PRAYER_NAMES,
  currentPrayer,
  minutesUntil,
  nextPrayer,
  prayerTimesFor,
  prayerWaitProgress,
} from '@/lib/prayer'
import { useLanguage, useT } from '@/lib/i18n'
import { formatTime } from '@/lib/prayer'

const RING_R = 21
const RING_LENGTH = 2 * Math.PI * RING_R

/**
 * A compact summary of the Prayer screen for Home: what comes next and how
 * far off it is. A shortcut into the full Prayer screen, not a second place
 * the times are worked out. The Qibla and Prayer tiles below it are the
 * other two shortcuts into that same screen.
 */
export default function PrayerQiblaCard() {
  const t = useT()
  const language = useLanguage()
  const { place, settings, ready } = usePrayerState()
  const clock = useNow(1000)

  if (!ready || !clock) {
    return (
      <section aria-label={t('Prayer')}>
        <h2 className="home-label mb-[9px]">{t('Prayer')}</h2>
        <div className="h-[7.5rem] animate-pulse rounded-2xl bg-[var(--home-track)]" />
      </section>
    )
  }

  const now = clock
  const times = prayerTimesFor(place, now, settings)
  const next = nextPrayer(place, settings, now)
  const current = currentPrayer(times, now)
  const waited = prayerWaitProgress(place, settings, times, current, next, now)
  const minutesLeft = minutesUntil(next.at, now)
  const timeLeft =
    minutesLeft >= 60
      ? t('{h}h {m}m', { h: Math.floor(minutesLeft / 60), m: minutesLeft % 60 })
      : t('{m}m', { m: minutesLeft })

  return (
    <section aria-label={t('Prayer')}>
      <h2 className="home-label mb-[9px]">{t('Prayer')}</h2>

      <div className="home-card overflow-hidden rounded-2xl">
        <Link href="/prayer" className="home-press ed-focus flex items-center gap-4 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--home-muted)]">
              {t('Next prayer')}
            </p>
            <p className="home-serif mt-1 truncate text-[1.3125rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--home-heading)]">
              {t(PRAYER_NAMES[next.id])}
            </p>
            <p className="mt-0.5 text-[0.8125rem] font-medium tabular-nums text-[var(--home-muted)]">
              {formatTime(next.at, language, place.timeZone)} · {t('{timeLeft} left', { timeLeft })}
            </p>
          </div>
          <div className="relative h-[3.5rem] w-[3.5rem] shrink-0">
            <svg viewBox="0 0 52 52" className="h-full w-full -rotate-90" aria-hidden>
              <defs>
                <linearGradient id="prayer-ring-home" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#c9d92e" />
                  <stop offset="1" stopColor="#1fb56a" />
                </linearGradient>
              </defs>
              <circle cx="26" cy="26" r={RING_R} fill="none" strokeWidth="5" className="prayer-hero__ring-track" />
              <circle
                cx="26"
                cy="26"
                r={RING_R}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={RING_LENGTH}
                strokeDashoffset={RING_LENGTH * (1 - waited)}
                stroke="url(#prayer-ring-home)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[0.75rem] font-bold tabular-nums text-[var(--home-heading)]">
              {timeLeft}
            </span>
          </div>
        </Link>
      </div>
    </section>
  )
}
