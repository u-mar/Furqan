import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla, type CalculationParameters } from 'adhan'

/**
 * Prayer times and the qibla, worked out on the phone from where it is and the
 * date, so they need no connection and no account. The maths is the `adhan`
 * library's (the same used by many prayer apps); this file chooses the method,
 * finds what comes next, and keeps the person's choices.
 */

export type PrayerId = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export const PRAYER_ORDER: PrayerId[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
/** Sunrise ends Fajr; it is shown but there is no adhan for it. */
export const ADHAN_PRAYERS: PrayerId[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export const PRAYER_NAMES: Record<PrayerId, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
}

export type MethodId =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'Singapore'
  | 'Turkey'
  | 'NorthAmerica'

export const METHODS: { id: MethodId; label: string }[] = [
  { id: 'MuslimWorldLeague', label: 'Muslim World League' },
  { id: 'UmmAlQura', label: 'Umm al-Qura, Makkah' },
  { id: 'Egyptian', label: 'Egyptian General Authority' },
  { id: 'Karachi', label: 'University of Karachi' },
  { id: 'Dubai', label: 'Dubai' },
  { id: 'Qatar', label: 'Qatar' },
  { id: 'Kuwait', label: 'Kuwait' },
  { id: 'Singapore', label: 'Singapore' },
  { id: 'Turkey', label: 'Turkey (Diyanet)' },
  { id: 'NorthAmerica', label: 'North America (ISNA)' },
]

export interface PrayerSettings {
  method: MethodId
  /** Shafi'i, Maliki and Hanbali count Asr earlier than Hanafi. */
  madhab: 'shafi' | 'hanafi'
  /** Whether the adhan sounds at all, and for which prayers. */
  adhan: boolean
  adhanFor: Record<Exclude<PrayerId, 'sunrise'>, boolean>
}

export const DEFAULT_PRAYER_SETTINGS: PrayerSettings = {
  method: 'MuslimWorldLeague',
  madhab: 'shafi',
  adhan: true,
  adhanFor: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
}

export interface Place {
  lat: number
  lon: number
  /** What to call it. Empty for a position taken from the phone. */
  name: string
  /** A named place keeps its own clock; the phone's position uses the phone's. */
  timeZone?: string
  source: 'device' | 'city' | 'default'
}

export const CITIES: Place[] = [
  { name: 'Mogadishu', lat: 2.0469, lon: 45.3182, timeZone: 'Africa/Mogadishu', source: 'city' },
  { name: 'Hargeisa', lat: 9.5624, lon: 44.077, timeZone: 'Africa/Mogadishu', source: 'city' },
  { name: 'Kismayo', lat: -0.3582, lon: 42.5454, timeZone: 'Africa/Mogadishu', source: 'city' },
  { name: 'Nairobi', lat: -1.2921, lon: 36.8219, timeZone: 'Africa/Nairobi', source: 'city' },
  { name: 'Djibouti', lat: 11.5721, lon: 43.1456, timeZone: 'Africa/Djibouti', source: 'city' },
  { name: 'Addis Ababa', lat: 9.0301, lon: 38.7469, timeZone: 'Africa/Addis_Ababa', source: 'city' },
  { name: 'Makkah', lat: 21.3891, lon: 39.8579, timeZone: 'Asia/Riyadh', source: 'city' },
  { name: 'Madinah', lat: 24.4672, lon: 39.6024, timeZone: 'Asia/Riyadh', source: 'city' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, timeZone: 'Africa/Cairo', source: 'city' },
  { name: 'Dubai', lat: 25.2048, lon: 55.2708, timeZone: 'Asia/Dubai', source: 'city' },
  { name: 'Istanbul', lat: 41.0082, lon: 28.9784, timeZone: 'Europe/Istanbul', source: 'city' },
  { name: 'London', lat: 51.5074, lon: -0.1278, timeZone: 'Europe/London', source: 'city' },
  { name: 'Minneapolis', lat: 44.9778, lon: -93.265, timeZone: 'America/Chicago', source: 'city' },
  { name: 'Toronto', lat: 43.6532, lon: -79.3832, timeZone: 'America/Toronto', source: 'city' },
]

/** Until the phone says where it is. Mogadishu, where most of the app's readers are. */
export const DEFAULT_PLACE: Place = { ...CITIES[0], source: 'default' }

function parameters(settings: PrayerSettings): CalculationParameters {
  const params = CalculationMethod[settings.method]()
  params.madhab = settings.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi
  return params
}

export type DayTimes = Record<PrayerId, Date>

export function prayerTimesFor(place: Place, date: Date, settings: PrayerSettings): DayTimes {
  const t = new PrayerTimes(new Coordinates(place.lat, place.lon), date, parameters(settings))
  return { fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha }
}

export interface NextPrayer {
  id: PrayerId
  at: Date
}

/** What comes next after `now`: the rest of today, or tomorrow's Fajr. */
export function nextPrayer(place: Place, settings: PrayerSettings, now: Date): NextPrayer {
  const today = prayerTimesFor(place, now, settings)
  for (const id of PRAYER_ORDER) if (today[id].getTime() > now.getTime()) return { id, at: today[id] }
  const tomorrow = prayerTimesFor(place, new Date(now.getTime() + 24 * 3600 * 1000), settings)
  return { id: 'fajr', at: tomorrow.fajr }
}

/** The prayer time that has most recently begun, or null before Fajr. */
export function currentPrayer(times: DayTimes, now: Date): PrayerId | null {
  let current: PrayerId | null = null
  for (const id of PRAYER_ORDER) if (times[id].getTime() <= now.getTime()) current = id
  return current
}

/* ---------------------------------------------------------------- qibla */

export const KAABA = { lat: 21.4225, lon: 39.8262 }

/** Degrees clockwise from true north to the Kaaba. */
export function qiblaBearing(place: Pick<Place, 'lat' | 'lon'>): number {
  return Qibla(new Coordinates(place.lat, place.lon))
}

/** Great-circle distance to the Kaaba, in kilometres. */
export function distanceToKaabaKm(place: Pick<Place, 'lat' | 'lon'>): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(KAABA.lat - place.lat)
  const dLon = rad(KAABA.lon - place.lon)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(place.lat)) * Math.cos(rad(KAABA.lat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/* ------------------------------------------------------------- storage */

const SETTINGS_KEY = 'muyassar_prayer_settings'
const PLACE_KEY = 'muyassar_prayer_place'
export const PRAYER_CHANGED_EVENT = 'prayer-settings-changed'

export function readPrayerSettings(): PrayerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_PRAYER_SETTINGS
    const saved = JSON.parse(raw) as Partial<PrayerSettings>
    return {
      method: METHODS.some((m) => m.id === saved.method) ? (saved.method as MethodId) : DEFAULT_PRAYER_SETTINGS.method,
      madhab: saved.madhab === 'hanafi' ? 'hanafi' : 'shafi',
      adhan: saved.adhan !== false,
      adhanFor: { ...DEFAULT_PRAYER_SETTINGS.adhanFor, ...(saved.adhanFor ?? {}) },
    }
  } catch {
    return DEFAULT_PRAYER_SETTINGS
  }
}

export function savePrayerSettings(patch: Partial<PrayerSettings>): PrayerSettings {
  const next = { ...readPrayerSettings(), ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // Only a memory of the choice.
  }
  window.dispatchEvent(new CustomEvent(PRAYER_CHANGED_EVENT))
  return next
}

export function readPlace(): Place {
  try {
    const raw = localStorage.getItem(PLACE_KEY)
    if (!raw) return DEFAULT_PLACE
    const saved = JSON.parse(raw) as Place
    if (Number.isFinite(saved.lat) && Number.isFinite(saved.lon)) return saved
  } catch {
    // Fall through.
  }
  return DEFAULT_PLACE
}

export function savePlace(place: Place): void {
  try {
    localStorage.setItem(PLACE_KEY, JSON.stringify(place))
  } catch {
    // Only a memory of the choice.
  }
  window.dispatchEvent(new CustomEvent(PRAYER_CHANGED_EVENT))
}

/** Ask the phone where it is. Rejects with the browser's own reason. */
export function locateDevice(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: '', source: 'device' }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed')),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 }
    )
  })
}

export function formatTime(date: Date, language: string, timeZone?: string): string {
  const locale = language === 'ar' ? 'ar' : language === 'so' ? 'so' : 'en-US'
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
  }
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
