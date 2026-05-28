/**
 * Somali voice translation — timestamp-based playback inside hosted MP3 chunks.
 *
 * - manifest.json (timings) → commit in repo under public/data/somali-voice/
 * - .mp3 files → host on CDN (production) or public/data/somali-voice/audio/ (local dev)
 */

/** How `start` / `end` are written in manifest.json */
export type SomaliVoiceTimeFormat =
  | 'seconds' // HTML audio seconds, e.g. 21.5
  | 'm.ss' // minutes.seconds — e.g. "0.21" = 0 min 21 sec, "1.10" = 1:10

export interface SomaliVoiceAyahTiming {
  key: string
  /** Prefer strings for m.ss so "0.40" is not rounded to 0.4 in JSON */
  start: number | string
  end: number | string
}

export interface SomaliVoiceChunk {
  file: string
  ayahs: SomaliVoiceAyahTiming[]
}

export interface SomaliVoiceManifest {
  version?: number
  /** Default: m.ss (minutes.seconds). Set "seconds" for raw second values. */
  timeFormat?: SomaliVoiceTimeFormat
  chunks: SomaliVoiceChunk[]
}

export interface SomaliVoiceSegment {
  verseKey: string
  file: string
  audioUrl: string
  start: number
  end: number
}

let manifestPromise: Promise<SomaliVoiceManifest | null> | null = null
let segmentIndex: Map<string, SomaliVoiceSegment> | null = null

/** Public URL for timing manifest (served from /public). */
export const SOMALI_VOICE_MANIFEST_PATH = '/data/somali-voice/manifest.json'

/** Shown when Somali tafseer audio is not recorded for an ayah or page yet. */
export const TAFSIR_UNAVAILABLE_MESSAGE =
  'Tafseer for this ayah is not available yet — I am working on it.'

/**
 * Base URL for MP3 files (no trailing slash).
 * Production: set NEXT_PUBLIC_SOMALI_VOICE_CDN_URL=https://your-cdn.com/somali-v1
 * Local dev: leave unset → uses /data/somali-voice/audio (files in public/)
 */
export function getSomaliVoiceAudioBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOMALI_VOICE_CDN_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return '/data/somali-voice/audio'
}

export function somaliVoiceAudioUrl(fileName: string): string {
  const base = getSomaliVoiceAudioBaseUrl()
  const file = fileName.replace(/^\//, '')
  return `${base}/${file}`
}

/**
 * Convert manifest timestamp → seconds for HTMLAudioElement.currentTime.
 * m.ss: "0.1" = 1s, "0.21" = 21s, "1.10" = 70s (1 min 10 sec).
 */
export function parseSomaliTimestamp(
  value: number | string,
  format: SomaliVoiceTimeFormat = 'm.ss'
): number {
  if (format === 'seconds') {
    const n = typeof value === 'number' ? value : parseFloat(value)
    return Number.isFinite(n) ? n : 0
  }

  const raw = typeof value === 'string' ? value.trim() : String(value)
  const dot = raw.indexOf('.')
  if (dot === -1) {
    return (parseInt(raw, 10) || 0) * 60
  }
  const minutes = parseInt(raw.slice(0, dot), 10) || 0
  const seconds = parseInt(raw.slice(dot + 1), 10) || 0
  return minutes * 60 + seconds
}

function buildSegmentIndex(manifest: SomaliVoiceManifest): Map<string, SomaliVoiceSegment> {
  const timeFormat = manifest.timeFormat ?? 'm.ss'
  const map = new Map<string, SomaliVoiceSegment>()
  for (const chunk of manifest.chunks) {
    const audioUrl = somaliVoiceAudioUrl(chunk.file)
    for (const ayah of chunk.ayahs) {
      const start = parseSomaliTimestamp(ayah.start, timeFormat)
      const end = parseSomaliTimestamp(ayah.end, timeFormat)
      if (!ayah.key || end <= start) continue
      map.set(ayah.key, {
        verseKey: ayah.key,
        file: chunk.file,
        audioUrl,
        start,
        end,
      })
    }
  }
  return map
}

export async function loadSomaliVoiceManifest(): Promise<SomaliVoiceManifest | null> {
  if (typeof window === 'undefined') return null

  if (!manifestPromise) {
    manifestPromise = fetch(SOMALI_VOICE_MANIFEST_PATH)
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as SomaliVoiceManifest
        if (!Array.isArray(data.chunks)) return null
        segmentIndex = buildSegmentIndex(data)
        return data
      })
      .catch(() => null)
  }

  return manifestPromise
}

export async function getSomaliVoiceSegment(verseKey: string): Promise<SomaliVoiceSegment | null> {
  await loadSomaliVoiceManifest()
  return segmentIndex?.get(verseKey) ?? null
}

export async function hasSomaliVoiceForVerse(verseKey: string): Promise<boolean> {
  const segment = await getSomaliVoiceSegment(verseKey)
  return segment !== null
}

export function clearSomaliVoiceCache(): void {
  manifestPromise = null
  segmentIndex = null
}
