'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNow, usePrayerState } from '@/hooks/usePrayer'
import { formatHijri, toHijri } from '@/lib/hijri'
import {
  ARC_BOX,
  ARC_PATH,
  DAILY_PRAYERS,
  MOON_AT,
  SKIES,
  arcPoint,
  homeSkyState,
  type DailyPrayer,
  type HomeSkyState,
} from '@/lib/home-sky'
import { PRAYER_NAMES, formatTime, minutesUntil } from '@/lib/prayer'
import { tr, useLanguage, useT } from '@/lib/i18n'

/** One line each: sunrise, the high sun, the lower sun, sunset, the moon. */
const PRAYER_ICONS: Record<DailyPrayer, string> = {
  fajr: 'M3 18h18M7 18a5 5 0 0 1 10 0M12 7v3M5.6 11.6l1.8 1.4M18.4 11.6l-1.8 1.4M9 4.5L12 2l3 2.5',
  dhuhr:
    'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  asr: 'M12 10a4 4 0 1 0 0 8a4 4 0 1 0 0-8M3 21h18M12 4v2.5M5.5 7.5l1.6 1.6M18.5 7.5l-1.6 1.6',
  maghrib: 'M3 16h18M7 16a5 5 0 0 1 10 0M12 4v6M9.5 7.5L12 10l2.5-2.5M7 20h10',
  isha: 'M15 4a8 8 0 1 0 5 13A6.5 6.5 0 0 1 15 4zM19 3v3M17.5 4.5h3',
}

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

/** "Subax (Fajr)" → "Subax": the name alone, where there is room for little else. */
function prayerName(id: DailyPrayer): string {
  return tr(PRAYER_NAMES[id]).replace(/\s*\(.*\)\s*$/, '')
}

/** "3 Jumada I 1448" and "Thursday, 15 October". */
function heroDates(date: Date, language: string): { hijri: string; gregorian: string } {
  const { day, year, monthName } = toHijri(date)
  const hijri = language === 'ar' ? formatHijri(date) : `${day} ${tr(monthName)} ${year}`
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(language), options).format(date)
  return { hijri, gregorian: `${part({ weekday: 'long' })}, ${date.getDate()} ${part({ month: 'long' })}` }
}

/**
 * Home's top: the sky of the hour where the person is, the sun on its real
 * path (the moon once it has set), the next prayer large beneath it and the
 * day's five prayers on a card at the skyline. The rest of Home follows as
 * children, on the ground the sky settles into.
 */
export default function HomeSkyScreen({ displayName, children }: { displayName: string; children: ReactNode }) {
  const language = useLanguage()
  const { place, settings, ready } = usePrayerState()
  const clock = useNow(10_000)
  const state = useMemo(
    () => (ready && clock ? homeSkyState(place, settings, clock) : null),
    [ready, clock, place, settings]
  )
  const [dates, setDates] = useState<{ hijri: string; gregorian: string } | null>(null)

  useEffect(() => {
    setDates(heroDates(new Date(), language))
  }, [language])

  const sky = SKIES[state?.sky ?? 'isha']
  const vars = {
    '--hv-s0': sky.dark[0],
    '--hv-s1': sky.dark[1],
    '--hv-s2': sky.dark[2],
    '--hv-l0': sky.light[0],
    '--hv-l1': sky.light[1],
    '--hv-l2': sky.light[2],
    '--hv-ground-sky': sky.ground,
    '--hv-sky-glow': sky.glow,
    '--hv-windows': sky.windows,
  } as CSSProperties

  return (
    <main
      className="home-v2 relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom)+2.25rem)] [overscroll-behavior-x:none] [touch-action:pan-y]"
      data-sky={state ? state.sky : undefined}
      style={vars}
    >
      <div className="relative">
        <div className="home-sky" aria-hidden />

        <div className="relative mx-auto w-full max-w-lg px-5 pt-[max(3.25rem,calc(env(safe-area-inset-top)+0.75rem))]">
          <HeroTop displayName={displayName} dates={dates} />
          <SunPath state={state} clock={clock} timeZone={place.timeZone} />
          <Skyline />
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-lg flex-col gap-8 px-5">
        <TodayCard state={state} timeZone={place.timeZone} />
        {children}
      </div>
    </main>
  )
}

function HeroTop({ displayName, dates }: { displayName: string; dates: { hijri: string; gregorian: string } | null }) {
  const t = useT()
  return (
    <header className="reveal flex items-start justify-between gap-3">
      <div className="home-hero-ink flex min-w-0 flex-1 flex-col">
        <span lang="ar" dir="rtl" className="amiri self-start !text-left text-[1.3125rem] leading-[1.55] text-[var(--hv-gold)]">
          ٱلسَّلَامُ عَلَيْكُمْ
        </span>
        <h1 className="home-serif truncate text-[2.125rem] font-medium leading-[1.08] tracking-[-0.025em] text-[var(--hv-ink)]">
          {displayName}
        </h1>
        {/* The dot between the two dates drops out if they wrap onto two lines. */}
        <p className="mt-2.5 min-h-[1.25rem] overflow-hidden text-[0.78125rem] tracking-[0.01em] text-[var(--hv-ink2)]">
          {dates ? (
            <span className="home-dates">
              <span className="home-dates__item">
                <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" className="shrink-0 fill-[var(--hv-gold)]">
                  <path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2Z" />
                </svg>
                <span className="font-semibold text-[var(--hv-ink)]">{dates.hijri}</span>
              </span>
              <span className="home-dates__item">{dates.gregorian}</span>
            </span>
          ) : null}
        </p>
      </div>

      <Link href="/settings" className="home-glass-round ed-focus" aria-label={t('Open settings')}>
        <svg aria-hidden width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </Link>
    </header>
  )
}

/** The sun's path across the sky, the next prayer large beneath it. */
function SunPath({ state, clock, timeZone }: { state: HomeSkyState | null; clock: Date | null; timeZone?: string }) {
  const t = useT()
  const language = useLanguage()

  const name = state ? prayerName(state.next.id) : ''
  const sun = state && state.sun !== null ? arcPoint(state.sun) : null
  const glowAt = sun ?? MOON_AT
  const left = state && clock ? minutesUntil(state.next.at, clock) : 0
  const timeLeft =
    left >= 60 ? t('{h}h {m}m', { h: Math.floor(left / 60), m: left % 60 }) : t('{m}m', { m: left })

  return (
    // The path is drawn the full width of the screen, so its sizes are the
    // content's width plus the 2.5rem of padding either side of it.
    <div className="relative -mx-5 mt-[4.5rem] pt-[calc(19.49%+7.8px)]">
      {/* The light around the sun (or the moon), on the sky behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 aspect-[390/200]">
        <div
          className="home-sky-glow"
          style={{ left: `${(glowAt.x / ARC_BOX.width) * 100}%`, top: `${(glowAt.y / ARC_BOX.height) * 100}%` }}
        />
      </div>

      <svg
        aria-hidden
        viewBox={`0 0 ${ARC_BOX.width} ${ARC_BOX.height}`}
        className="home-arc absolute inset-x-0 top-0 h-auto w-full overflow-visible"
      >
        <path d={ARC_PATH} className="home-arc__path" />
        {state?.marks.map((mark) => {
          const at = arcPoint(mark.t)
          const on = mark.id === state.next.id
          return (
            <circle
              key={mark.id}
              cx={at.x}
              cy={at.y}
              r={on ? 4.5 : 3}
              className={on ? 'home-arc__mark home-arc__mark--on' : 'home-arc__mark'}
            />
          )
        })}
        {sun ? (
          <g>
            <circle cx={sun.x} cy={sun.y} r="36" className="home-arc__sun-glow" opacity="0.14" />
            <circle cx={sun.x} cy={sun.y} r="21" className="home-arc__sun-glow" opacity="0.26" />
            <circle cx={sun.x} cy={sun.y} r="11" className="home-arc__sun" />
          </g>
        ) : state ? (
          <g>
            <defs>
              <radialGradient id="home-moon-glow">
                <stop offset="0" className="home-arc__moon-glow" stopOpacity="0.34" />
                <stop offset="1" className="home-arc__moon-glow" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={MOON_AT.x} cy={MOON_AT.y} r="40" fill="url(#home-moon-glow)" />
            <path d="M305 48 A16 16 0 1 0 316 75 A12.5 12.5 0 0 1 305 48 Z" className="home-arc__moon" />
            <circle cx="250" cy="40" r="1.4" className="home-arc__moon" />
            <circle cx="340" cy="30" r="1.1" className="home-arc__moon" />
            <circle cx="120" cy="56" r="1.2" className="home-arc__moon" />
            <circle cx="70" cy="96" r="1" className="home-arc__moon" />
            <circle cx="196" cy="22" r="0.9" className="home-arc__moon" />
          </g>
        ) : null}
      </svg>

      <Link
        href="/prayer"
        className="home-hero-ink relative z-10 mx-auto flex w-fit max-w-full flex-col items-center px-5 text-center text-[var(--hv-ink)]"
      >
        <span className="text-[0.65625rem] font-semibold uppercase tracking-[0.24em] text-[var(--hv-ink2)]">
          {t('Next prayer')}
        </span>
        {/* Long names step down a size, so they clear the sun on its path. */}
        <span
          className={`home-serif mt-1.5 flex h-16 items-center whitespace-nowrap font-medium leading-none tracking-[-0.035em] ${
            name.length > 5 ? 'text-[clamp(2.75rem,14.5vw,3.5rem)]' : 'text-[clamp(3rem,16.5vw,4rem)]'
          }`}
        >
          {name}
        </span>
        <span className="home-pill mt-3">
          {state && clock ? (
            <>
              <span aria-hidden className="home-pill__dot" />
              <span className="text-[0.9375rem] font-bold tabular-nums text-[#f2d394]">{t('in {time}', { time: timeLeft })}</span>
              <span className="text-[0.78125rem] font-medium tabular-nums text-[rgba(245,239,227,0.72)]">
                {t('at {time}', { time: formatTime(state.next.at, language, timeZone) })}
              </span>
            </>
          ) : null}
        </span>
      </Link>
    </div>
  )
}

/** A far row of domes and minarets and a near one, the windows lit after dark. */
function Skyline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 390 180"
      className="home-skyline pointer-events-none relative -mx-5 mt-[calc(-12.82%+7px)] block h-auto w-[calc(100%+2.5rem)] overflow-visible"
    >
      <g className="home-skyline__far">
        <path d="M0 146 L0 128 Q4 112 26 108 Q48 112 52 128 L52 146 Z" />
        <path d="M113 62 L118 42 L123 62 Z" />
        <rect x="114.5" y="62" width="7" height="84" />
        <path d="M263 54 L268 34 L273 54 Z" />
        <rect x="264.5" y="54" width="7" height="92" />
        <path d="M338 146 L338 128 Q342 112 362 108 Q384 112 388 128 L388 146 Z" />
        <rect x="0" y="132" width="390" height="14" />
      </g>
      <g className="home-skyline__near">
        <path d="M44 34 L52 6 L60 34 Z" />
        <rect x="46" y="34" width="12" height="130" />
        <rect x="42" y="74" width="20" height="5" rx="1" />
        <rect x="43" y="110" width="18" height="4" rx="1" />
        <path d="M330 22 L338 -4 L346 22 Z" />
        <rect x="332" y="22" width="12" height="142" />
        <rect x="328" y="64" width="20" height="5" rx="1" />
        <rect x="329" y="104" width="18" height="4" rx="1" />
        <path d="M135 164 L135 112 Q135 62 195 50 Q255 62 255 112 L255 164 Z" />
        <rect x="194" y="30" width="2" height="22" />
        <path d="M72 164 L72 134 Q72 110 98 104 Q124 110 124 134 L124 164 Z" />
        <path d="M266 164 L266 134 Q266 110 292 104 Q318 110 318 134 L318 164 Z" />
        <rect x="0" y="146" width="390" height="34" />
      </g>
      <circle cx="195" cy="26" r="5" className="home-skyline__crescent" />
      <g className="home-skyline__windows">
        <path d="M183 164 L183 132 Q183 120 195 118 Q207 120 207 132 L207 164 Z" />
        <path d="M154 150 L154 132 Q154 124 161 123 Q168 124 168 132 L168 150 Z" />
        <path d="M222 150 L222 132 Q222 124 229 123 Q236 124 236 132 L236 150 Z" />
        <rect x="94" y="138" width="8" height="12" rx="4" />
        <rect x="288" y="138" width="8" height="12" rx="4" />
        <rect x="50" y="90" width="4" height="9" rx="2" />
        <rect x="336" y="82" width="4" height="9" rx="2" />
      </g>
    </svg>
  )
}

/** The day's five prayers, the next one lit, the day so far along a line beneath them. */
function TodayCard({ state, timeZone }: { state: HomeSkyState | null; timeZone?: string }) {
  const t = useT()
  const language = useLanguage()

  if (!state) {
    return <div className="home-today home-today--loading mt-5 h-[11rem] animate-pulse" aria-hidden />
  }

  const nextIndex = state.tomorrow ? 0 : DAILY_PRAYERS.indexOf(state.next.id)
  const heading = state.tomorrow ? t('Tomorrow') : t('Today')

  return (
    <Link href="/prayer" className="home-today home-press reveal ed-focus mt-5 block" aria-label={`${heading}, ${t('All times')}`}>
      <span className="flex items-center justify-between px-2 pb-3.5">
        <span className="text-[0.65625rem] font-semibold uppercase tracking-[0.2em] text-[var(--hv-pc-label)]">{heading}</span>
        <span className="inline-flex items-center gap-[3px] text-[0.78125rem] font-semibold text-[var(--hv-pc-link)]">
          {t('All times')}
          <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </span>
      <ol className="grid grid-cols-5 gap-1">
        {DAILY_PRAYERS.map((id, index) => {
          const on = index === nextIndex
          const past = index < nextIndex
          return (
            <li
              key={id}
              className={on ? 'home-today__cell home-today__cell--on' : past ? 'home-today__cell home-today__cell--past' : 'home-today__cell'}
              aria-current={on ? 'time' : undefined}
            >
              <span className="max-w-full truncate px-0.5 text-[0.71875rem] font-semibold tracking-[0.02em]">{prayerName(id)}</span>
              <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" className="home-today__icon">
                <path d={PRAYER_ICONS[id]} />
              </svg>
              <span className="text-[0.875rem] font-semibold tabular-nums tracking-[-0.01em]">
                {shortTime(state.day[id], language, timeZone)}
              </span>
            </li>
          )
        })}
      </ol>
      <span aria-hidden className="home-today__rail">
        <span className="home-today__fill" style={{ width: `${state.progress * 100}%` }} />
        <span className="home-today__now" style={{ insetInlineStart: `${state.progress * 100}%` }} />
      </span>
    </Link>
  )
}
