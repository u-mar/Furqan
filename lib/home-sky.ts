import { ADHAN_PRAYERS, prayerTimesFor, type DayTimes, type Place, type PrayerId, type PrayerSettings } from '@/lib/prayer'

/**
 * The sky at the top of Home: one sky for the whole day in each theme — night
 * in the dark themes, a soft sage day with a gold horizon in light — with the
 * sun where it really is on its path, or the moon once it has set. Pure, so it
 * can be tested and worked out the same way every time.
 */

export interface Sky {
  /** Top, middle and horizon of the sky. */
  colors: [string, string, string]
  /** The light around the sun, and around the moon. */
  sunGlow: string
  moonGlow: string
}

/** The dark themes' sky: Isha's night, all day, settling into its own dark ground. */
export const NIGHT_SKY: Sky & { ground: string } = {
  colors: ['#040a17', '#0a1a2e', '#13314a'],
  ground: '#050c15',
  sunGlow: 'rgba(255, 206, 128, 0.24)',
  moonGlow: 'rgba(150, 178, 255, 0.28)',
}

/** Light's sky, as the design has it: a soft mint above, warming to cream at the horizon, on into the sand. */
export const DAY_SKY: Sky = {
  colors: ['#dde8e2', '#e7e6d7', '#ece4d1'],
  sunGlow: 'rgba(255, 240, 196, 0.45)',
  moonGlow: 'rgba(140, 150, 140, 0.22)',
}

/** The five daily prayers, in order. */
export type DailyPrayer = Exclude<PrayerId, 'sunrise'>
export const DAILY_PRAYERS = ADHAN_PRAYERS as DailyPrayer[]

/** The sun's path is drawn in a 390 × 150 box: centre (195, 146), 175 wide and 120 high. */
export const ARC_BOX = { width: 390, height: 150 }
export const ARC_PATH = 'M20 146 A175 120 0 0 1 370 146'
export const MOON_AT = { x: 300, y: 46 }

export function arcPoint(t: number): { x: number; y: number } {
  return {
    x: Math.round((195 - 175 * Math.cos(Math.PI * t)) * 10) / 10,
    y: Math.round((146 - 120 * Math.sin(Math.PI * t)) * 10) / 10,
  }
}

export interface HomeSkyState {
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
