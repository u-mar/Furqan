'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { useNow, usePrayerState } from '@/hooks/usePrayer'
import { formatHijri, toHijri } from '@/lib/hijri'
import {
  ARC_BOX,
  ARC_PATH,
  DAILY_PRAYERS,
  MOON_AT,
  DAY_SKY,
  NIGHT_SKY,
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

/** "3 Jumada I 1448" and "Thu, 15 Oct". */
function dayDates(date: Date, language: string): { hijri: string; gregorian: string } {
  const { day, year, monthName } = toHijri(date)
  const hijri = language === 'ar' ? formatHijri(date) : `${day} ${tr(monthName)} ${year}`
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale(language), options).format(date)
  return { hijri, gregorian: `${part({ weekday: 'short' })}, ${date.getDate()} ${part({ month: 'short' })}` }
}

/**
 * Everything on Home is sized to fit one phone screen. Where it still does not
 * — a small phone, or an iPhone's notch and home bar taking their share — the
 * page tightens itself a step at a time (data-tight 1, then 2) until it does.
 */
function useFitToScreen() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const main = ref.current
    if (!main) return
    const fit = () => {
      for (const step of ['', '1', '2']) {
        if (step) main.dataset.tight = step
        else delete main.dataset.tight
        if (main.offsetHeight <= window.innerHeight + 1) return
      }
    }
    fit()
    // The verse and the times fill in after the first paint, and the phone can
    // turn. Refitting waits a frame, so it never resizes inside the observer.
    let frame = 0
    const refit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    }
    const observer = new ResizeObserver(refit)
    observer.observe(main)
    window.addEventListener('resize', refit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', refit)
    }
  }, [])
  return ref
}

/**
 * Home, all on one screen: the sky of the hour where the person is, the sun
 * on its real path (the moon once it has set), the next prayer beneath it and
 * the day's five prayers on a card at the skyline. The rest of Home follows as
 * children, compact, on the ground the sky settles into. On a taller phone the
 * sky takes the extra room.
 */
export default function HomeSkyScreen({ displayName, children }: { displayName: string; children: ReactNode }) {
  const { place, settings, ready } = usePrayerState()
  const clock = useNow(10_000)
  const state = useMemo(
    () => (ready && clock ? homeSkyState(place, settings, clock) : null),
    [ready, clock, place, settings]
  )
  const mainRef = useFitToScreen()

  // One sky all day in each theme, lit by the sun while it is up and by the
  // moon once it has set. In light the skyline's windows come on after sunset.
  const moon = state !== null && state.sun === null
  const vars = {
    '--hv-s0': NIGHT_SKY.colors[0],
    '--hv-s1': NIGHT_SKY.colors[1],
    '--hv-s2': NIGHT_SKY.colors[2],
    '--hv-l0': DAY_SKY.colors[0],
    '--hv-l1': DAY_SKY.colors[1],
    '--hv-l2': DAY_SKY.colors[2],
    '--hv-ground-sky': NIGHT_SKY.ground,
    '--hv-sky-glow-dark': moon ? NIGHT_SKY.moonGlow : NIGHT_SKY.sunGlow,
    '--hv-sky-glow': moon ? DAY_SKY.moonGlow : DAY_SKY.sunGlow,
    '--hv-windows': moon ? 0.9 : 0,
  } as CSSProperties

  return (
    <main
      ref={mainRef}
      className="hv-theme home-v2 relative flex min-h-[100dvh] w-full flex-col overflow-x-hidden pb-[calc(4.25rem+env(safe-area-inset-bottom)+0.625rem)] [overscroll-behavior-x:none] [touch-action:pan-y]"
      data-sky={state ? (moon ? 'moon' : 'sun') : undefined}
      style={vars}
    >
      <div className="relative flex flex-1 flex-col">
        <div className="home-sky" aria-hidden />

        <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col px-5 pt-[max(0.875rem,calc(env(safe-area-inset-top)+0.5rem))]">
          <HeroTop displayName={displayName} />
          <div className="mt-auto pt-2">
            <SunPath state={state} clock={clock} timeZone={place.timeZone} />
            <Skyline />
          </div>
        </div>
      </div>

      <div className="home-cards relative mx-auto flex w-full max-w-lg flex-col gap-2.5 px-5">
        <TodayCard state={state} clock={clock} timeZone={place.timeZone} />
        {children}
      </div>
    </main>
  )
}

function HeroTop({ displayName }: { displayName: string }) {
  const t = useT()
  return (
    <header className="reveal flex items-start justify-between gap-3">
      <div className="home-hero-ink flex min-w-0 flex-1 flex-col">
        <span lang="ar" dir="rtl" className="amiri self-start !text-left text-[1.0625rem] leading-[1.4] text-[var(--hv-gold)]">
          ٱلسَّلَامُ عَلَيْكُمْ
        </span>
        <h1 className="home-serif truncate text-[1.625rem] font-medium leading-[1.1] tracking-[-0.025em] text-[var(--hv-ink)]">
          {displayName}
        </h1>
      </div>

      <Link href="/settings" className="home-glass-round ed-focus" aria-label={t('Open settings')}>
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </Link>
    </header>
  )
}

/** The sun's path across the sky, the next prayer beneath it. */
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
    <div className="home-arc-wrap relative -mx-5 pt-[calc(10.26%+4.1px)]">
      {/* The light around the sun (or the moon), on the sky behind everything */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 aspect-[390/150]">
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
            <circle cx={sun.x} cy={sun.y} r="30" className="home-arc__sun-glow" opacity="0.14" />
            <circle cx={sun.x} cy={sun.y} r="18" className="home-arc__sun-glow" opacity="0.26" />
            <circle cx={sun.x} cy={sun.y} r="9.5" className="home-arc__sun" />
          </g>
        ) : state ? (
          <g>
            <defs>
              <radialGradient id="home-moon-glow">
                <stop offset="0" className="home-arc__moon-glow" stopOpacity="0.34" />
                <stop offset="1" className="home-arc__moon-glow" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={MOON_AT.x} cy={MOON_AT.y} r="36" fill="url(#home-moon-glow)" />
            <path d="M305 31 A15 15 0 1 0 315 56 A11.5 11.5 0 0 1 305 31 Z" className="home-arc__moon" />
            <circle cx="250" cy="28" r="1.4" className="home-arc__moon" />
            <circle cx="342" cy="20" r="1.1" className="home-arc__moon" />
            <circle cx="122" cy="40" r="1.2" className="home-arc__moon" />
            <circle cx="68" cy="74" r="1" className="home-arc__moon" />
            <circle cx="196" cy="12" r="0.9" className="home-arc__moon" />
          </g>
        ) : null}
      </svg>

      <Link
        href="/prayer"
        className="home-hero-ink relative z-10 mx-auto flex w-fit max-w-full flex-col items-center px-5 text-center text-[var(--hv-ink)]"
      >
        <span className="home-next-label text-[0.625rem] font-semibold uppercase leading-[1.3] tracking-[0.22em] text-[var(--hv-ink2)]">
          {t('Next prayer')}
        </span>
        {/* Long names step down a size, so they clear the sun on its path. */}
        <span
          className={`home-next-name home-serif mt-0.5 flex h-11 items-center whitespace-nowrap font-medium leading-none tracking-[-0.035em] ${
            name.length > 5 ? 'text-[2.25rem]' : 'text-[2.625rem]'
          }`}
        >
          {name}
        </span>
        <span className="home-pill mt-2">
          {state && clock ? (
            <>
              <span aria-hidden className="home-pill__dot" />
              <span className="text-[0.84375rem] font-bold tabular-nums text-[#f2d394]">{t('in {time}', { time: timeLeft })}</span>
              <span className="text-[0.71875rem] font-medium tabular-nums text-[rgba(245,239,227,0.72)]">
                {t('at {time}', { time: formatTime(state.next.at, language, timeZone) })}
              </span>
            </>
          ) : null}
        </span>
      </Link>
    </div>
  )
}

/**
 * A far row of domes and minarets and a near one, the windows lit after
 * dark. Its dome tops sit just under the next prayer's pill.
 */
function Skyline() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 390 110"
      className="home-skyline pointer-events-none relative -mx-5 mt-[calc(-9.23%+4.3px)] block h-auto w-[calc(100%+2.5rem)] overflow-visible"
    >
      <g className="home-skyline__far">
        <path d="M0 100 L0 90 Q4 79 24 76 Q44 79 48 90 L48 100 Z" />
        <path d="M113 44 L118 30 L123 44 Z" />
        <rect x="114.5" y="44" width="7" height="56" />
        <path d="M263 40 L268 26 L273 40 Z" />
        <rect x="264.5" y="40" width="7" height="60" />
        <path d="M342 100 L342 90 Q346 79 366 76 Q386 79 390 90 L390 100 Z" />
        <rect x="0" y="92" width="390" height="8" />
      </g>
      <g className="home-skyline__near">
        <path d="M45 26 L52 6 L59 26 Z" />
        <rect x="46" y="26" width="12" height="84" />
        <rect x="42" y="50" width="20" height="4" rx="1" />
        <rect x="43" y="74" width="18" height="3" rx="1" />
        <path d="M331 20 L338 0 L345 20 Z" />
        <rect x="332" y="20" width="12" height="90" />
        <rect x="328" y="44" width="20" height="4" rx="1" />
        <rect x="329" y="70" width="18" height="3" rx="1" />
        <path d="M138 104 L138 76 Q138 44 195 36 Q252 44 252 76 L252 104 Z" />
        <rect x="194" y="20" width="2" height="17" />
        <path d="M76 104 L76 86 Q76 70 100 66 Q124 70 124 86 L124 104 Z" />
        <path d="M266 104 L266 86 Q266 70 290 66 Q314 70 314 86 L314 104 Z" />
        <rect x="0" y="100" width="390" height="10" />
      </g>
      <circle cx="195" cy="16" r="4" className="home-skyline__crescent" />
      <g className="home-skyline__windows">
        <path d="M184 104 L184 84 Q184 76 195 74 Q206 76 206 84 L206 104 Z" />
        <path d="M156 94 L156 82 Q156 77 162 76 Q168 77 168 82 L168 94 Z" />
        <path d="M222 94 L222 82 Q222 77 228 76 Q234 77 234 82 L234 94 Z" />
        <rect x="96" y="88" width="8" height="10" rx="4" />
        <rect x="286" y="88" width="8" height="10" rx="4" />
        <rect x="50" y="60" width="4" height="8" rx="2" />
        <rect x="336" y="54" width="4" height="8" rx="2" />
      </g>
    </svg>
  )
}

/**
 * The day's five prayers, the next one lit, the day so far along a line
 * beneath them, under the day's date.
 */
function TodayCard({ state, clock, timeZone }: { state: HomeSkyState | null; clock: Date | null; timeZone?: string }) {
  const t = useT()
  const language = useLanguage()

  if (!state || !clock) {
    return <div className="home-today home-today--loading h-[6.25rem] animate-pulse" aria-hidden />
  }

  const nextIndex = state.tomorrow ? 0 : DAILY_PRAYERS.indexOf(state.next.id)
  const dates = dayDates(state.tomorrow ? state.next.at : clock, language)

  return (
    <Link href="/prayer" className="home-today home-press reveal ed-focus block" aria-label={`${dates.gregorian}, ${t('All times')}`}>
      <span className="flex items-center justify-between gap-3 px-1.5 pb-1.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.71875rem] text-[var(--hv-pc-label)]">
          <svg aria-hidden width="11" height="11" viewBox="0 0 24 24" className="shrink-0 fill-[var(--hv-accent-gold)]">
            <path d="M15.5 3.2A9 9 0 1 0 20.8 15 7.2 7.2 0 0 1 15.5 3.2Z" />
          </svg>
          <span className="truncate">
            <span className="font-semibold text-[var(--hv-normal-color)]">{state.tomorrow ? t('Tomorrow') : dates.hijri}</span>
            <span aria-hidden> · </span>
            {dates.gregorian}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-[2px] text-[0.75rem] font-semibold text-[var(--hv-pc-link)]">
          {t('All times')}
          <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="rtl:-scale-x-100">
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
              <span className="max-w-full truncate px-0.5 text-[0.6875rem] font-semibold tracking-[0.02em]">{prayerName(id)}</span>
              {/* The time with its small picture beside it, so the card stays one slim row. */}
              <span className="flex items-center gap-[3px]">
                <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" className="home-today__icon shrink-0">
                  <path d={PRAYER_ICONS[id]} />
                </svg>
                <span className="text-[0.8125rem] font-semibold tabular-nums tracking-[-0.01em]">
                  {shortTime(state.day[id], language, timeZone)}
                </span>
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
