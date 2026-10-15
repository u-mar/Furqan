import { ADHAN_PRAYERS, prayerTimesFor, type DayTimes, type Place, type PrayerId, type PrayerSettings } from '@/lib/prayer'

/**
 * The sky at the top of Home: it follows the real day where the person is —
 * a dawn sky before and around Fajr, the high sun through Dhuhr, gold through
 * Asr, the sunset at Maghrib and night after it — with the sun where it really
 * is on its path, or the moon once it has set. Pure, so it can be tested and
 * worked out the same way every time.
 */

export type SkyId = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export interface Sky {
  /** Top, middle and horizon of the sky, for the dark themes and for light. */
  dark: [string, string, string]
  light: [string, string, string]
  /** What the dark page below the sky settles into. */
  ground: string
  /** The light around the sun (or moon). */
  glow: string
  /** How lit the skyline's windows are, 0–1. */
  windows: number
}

export const SKIES: Record<SkyId, Sky> = {
  fajr: {
    dark: ['#141a36', '#4a3f66', '#e7a07f'],
    light: ['#e4dde8', '#efd9cb', '#ecdcc6'],
    ground: '#0b1622',
    glow: 'rgba(255, 168, 128, 0.42)',
    windows: 0.85,
  },
  dhuhr: {
    dark: ['#0d4a52', '#2d7c7f', '#a9d8c9'],
    light: ['#dde8e2', '#e7e6d7', '#ece4d1'],
    ground: '#0a2426',
    glow: 'rgba(255, 240, 196, 0.45)',
    windows: 0,
  },
  asr: {
    dark: ['#103a3c', '#6d6440', '#e9b56a'],
    light: ['#e6e2cf', '#efdcb4', '#eedbb8'],
    ground: '#0c2421',
    glow: 'rgba(255, 196, 110, 0.5)',
    windows: 0,
  },
  maghrib: {
    dark: ['#1b1838', '#743d52', '#f08a55'],
    light: ['#eadad6', '#efcfb6', '#ecd6bf'],
    ground: '#110f1e',
    glow: 'rgba(255, 138, 88, 0.55)',
    windows: 0.6,
  },
  isha: {
    dark: ['#040a17', '#0a1a2e', '#13314a'],
    light: ['#d7dbd3', '#dfdcd0', '#e5dfd1'],
    ground: '#050c15',
    glow: 'rgba(150, 178, 255, 0.28)',
    windows: 1,
  },
}

/** The five daily prayers, in order. */
export type DailyPrayer = Exclude<PrayerId, 'sunrise'>
export const DAILY_PRAYERS = ADHAN_PRAYERS as DailyPrayer[]

/** The sun's path is drawn in a 390 × 200 box: centre (195, 196), 175 wide and 150 high. */
export const ARC_BOX = { width: 390, height: 200 }
export const ARC_PATH = 'M20 196 A175 150 0 0 1 370 196'
export const MOON_AT = { x: 300, y: 64 }

export function arcPoint(t: number): { x: number; y: number } {
  return {
    x: Math.round((195 - 175 * Math.cos(Math.PI * t)) * 10) / 10,
    y: Math.round((196 - 150 * Math.sin(Math.PI * t)) * 10) / 10,
  }
}

export interface HomeSkyState {
  sky: SkyId
  /** The next of the five prayers, and when. */
  next: { id: DailyPrayer; at: Date }
  /** The day the five times below are from: today, or tomorrow once Isha has passed. */
  day: DayTimes
  tomorrow: boolean
  /** Where the sun is along its path, 0 (rising) to 1 (setting); null once it has set. */
  sun: number | null
  /** The four prayers that fall in daylight, marked on the sun's path. */
  marks: { id: DailyPrayer; t: number }[]
  /** How far through the five the day has come, 0–1, along a line through them. */
  progress: number
}

const MINUTE = 60_000
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function skyFor(times: DayTimes, now: number): SkyId {
  if (now < times.fajr.getTime() - 45 * MINUTE) return 'isha'
  if (now < times.sunrise.getTime() + 30 * MINUTE) return 'fajr'
  if (now < times.asr.getTime()) return 'dhuhr'
  if (now < times.maghrib.getTime() - 50 * MINUTE) return 'asr'
  if (now < times.maghrib.getTime() + 25 * MINUTE) return 'maghrib'
  return 'isha'
}

export function homeSkyState(place: Place, settings: PrayerSettings, now: Date): HomeSkyState {
  const today = prayerTimesFor(place, now, settings)
  const at = now.getTime()
  const rise = today.sunrise.getTime()
  const set = today.maghrib.getTime()
  const along = (time: number) => (time - rise) / Math.max(1, set - rise)

  let next: HomeSkyState['next'] | null = null
  for (const id of DAILY_PRAYERS) {
    if (today[id].getTime() > at) {
      next = { id, at: today[id] }
      break
    }
  }
  const tomorrow = next === null
  const day = tomorrow ? prayerTimesFor(place, new Date(at + 24 * 3600 * 1000), settings) : today
  if (!next) next = { id: 'fajr', at: day.fajr }

  // Along a line through the five: 0 at Fajr, 1 at Isha, the dot between the last and the next.
  const index = DAILY_PRAYERS.indexOf(next.id)
  let progress = 0
  if (!tomorrow && index > 0) {
    const from = day[DAILY_PRAYERS[index - 1]].getTime()
    const to = next.at.getTime()
    progress = (index - 1 + clamp((at - from) / Math.max(1, to - from), 0, 1)) / (DAILY_PRAYERS.length - 1)
  }

  const sunUp = at >= today.fajr.getTime() && at < set
  return {
    sky: skyFor(today, at),
    next,
    day,
    tomorrow,
    sun: sunUp ? clamp(along(at), 0, 1) : null,
    marks: (['fajr', 'dhuhr', 'asr', 'maghrib'] as const).map((id) => ({
      id,
      t: clamp(along(today[id].getTime()), 0.03, 0.97),
    })),
    progress,
  }
}
