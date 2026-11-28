/**
 * Listen qaris: verified reciters whose own whole-surah recordings the admin adds to Listen
 * (Admin → Listen qaris). Shapes shared by the server, the admin page and Listen.
 */

/** Listen's id for a Listen qari: never clashes with the built-in reciters'. */
export const LISTEN_QARI_PREFIX = 'naba_'

export function isListenQariId(id: string): boolean {
  return id.startsWith(LISTEN_QARI_PREFIX)
}

/** What Listen is told about a published Listen qari (GET /api/listen/reciters). */
export interface PublicListenQari {
  /** `naba_<slug>`. */
  id: string
  name: string
  nameAr?: string
  country: string
  city?: string
  qiraat: string
  style: string
  username?: string
  photoUrl?: string
  /** Surah number → its recording. Only approved surahs. */
  surahs: Record<string, string>
}

export interface ListenQarisResponse {
  reciters: PublicListenQari[]
  /** The viewer's country, as their connection shows it (two letters), when known. */
  country?: string
}

/** What the check (services/nadir-asr/listen_check.py) reports about an uploaded surah. */
export interface ListenSurahReport {
  surah: number
  durationSec: number
  originalDurationSec: number
  trimmed: { start: number; end: number }
  loudness: { inputLufs: number; outputLufs: number; truePeakDb: number }
  clipping: { peakDb: number; peakCount: number; clipped: boolean }
  noiseFloorDb: number
  speechToNoiseDb: number
  noise: 'quiet' | 'some' | 'noisy'
  longSilences: Array<{ atSeconds: number; seconds: number }>
  startsAbruptly: boolean
  endsAbruptly: boolean
  ayahs: {
    expected: number
    found: number
    missing: number[]
    outOfOrder: number[]
    repeated: number[]
    unclear: number[]
    otherSurah: { surah: number; ayahs: number } | null
  }
  output: { bytes: number; channels: number; bitrateKbps: number }
}

export type ListenSurahStatus = 'uploading' | 'checking' | 'checked' | 'approved' | 'rejected' | 'replaced' | 'failed'

/** How many things in a report want the admin's ear before approving. */
export function reportFlags(report: ListenSurahReport): number {
  const a = report.ayahs
  return (
    (a.otherSurah ? 1 : 0) +
    (a.missing.length ? 1 : 0) +
    (a.outOfOrder.length ? 1 : 0) +
    (a.repeated.length ? 1 : 0) +
    (a.unclear.length ? 1 : 0) +
    (report.clipping.clipped ? 1 : 0) +
    (report.noise !== 'quiet' ? 1 : 0) +
    (report.longSilences.length ? 1 : 0) +
    (report.startsAbruptly ? 1 : 0) +
    (report.endsAbruptly ? 1 : 0)
  )
}

/**
 * Countries offered when adding a qari; any other two-letter code can be typed. Their names come
 * from the phone's own language (Intl.DisplayNames).
 */
export const LISTEN_COUNTRIES = [
  'SO', 'KE', 'ET', 'DJ', 'TZ', 'UG', 'SD', 'EG', 'LY', 'TN', 'DZ', 'MA', 'MR', 'SN', 'ML', 'NE', 'NG', 'GH', 'GM', 'GN',
  'SA', 'YE', 'OM', 'AE', 'QA', 'KW', 'BH', 'JO', 'PS', 'SY', 'LB', 'IQ', 'TR', 'IR', 'AF', 'PK', 'IN', 'BD', 'MY', 'ID',
  'GB', 'US', 'CA', 'SE', 'NO', 'DK', 'FI', 'NL', 'DE', 'FR', 'IT', 'AU',
] as const

/** The country's flag ("KE" → 🇰🇪), from its two letters. */
export function countryFlag(code: string): string {
  const letters = code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(letters)) return ''
  return String.fromCodePoint(...[...letters].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function countryName(code: string, locale = 'en'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code.toUpperCase()) ?? code
  } catch {
    return code
  }
}
