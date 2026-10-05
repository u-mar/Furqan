/**
 * Server-side check of a recitation's ayah marks (which ayah starts when, and
 * when each of its words does), as sent from the phone with the upload. Anything malformed
 * is dropped silently: the marks only ever enrich the swipe view and the
 * share video.
 */

// A type rather than an interface, so the database's JSON field accepts it as it is.
export type VerseTimelineMark = {
  verseKey: string
  atSeconds: number
  words?: number[]
}

const MAX_VERSE_TIMELINE = 1000
const VERSE_KEY_RE = /^\d{1,3}:\d{1,3}$/
/** The longest ayah (2:282) has 128 words. */
const MAX_AYAH_WORDS = 200

/** `value` as ayah marks within a recording `maxSeconds` long; [] if it is not that. */
export function sanitizeVerseTimeline(value: unknown, maxSeconds: number): VerseTimelineMark[] {
  if (!Array.isArray(value)) return []
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(maxSeconds, n)) * 100) / 100
  return value
    .slice(0, MAX_VERSE_TIMELINE)
    .filter(
      (entry): entry is { verseKey: string; atSeconds: number } =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as { verseKey?: unknown }).verseKey === 'string' &&
        VERSE_KEY_RE.test((entry as { verseKey: string }).verseKey) &&
        Number.isFinite((entry as { atSeconds?: unknown }).atSeconds)
    )
    .map((entry) => {
      const words = (entry as { words?: unknown }).words
      const keep =
        Array.isArray(words) && words.length > 0 && words.length <= MAX_AYAH_WORDS && words.every((w) => Number.isFinite(w))
      return {
        verseKey: entry.verseKey,
        atSeconds: Math.max(0, Math.min(maxSeconds, entry.atSeconds)),
        ...(keep ? { words: (words as number[]).map(clamp) } : {}),
      }
    })
}

/** The same, from the JSON text a form sends. */
export function parseVerseTimeline(raw: string, maxSeconds: number): VerseTimelineMark[] {
  try {
    return sanitizeVerseTimeline(JSON.parse(raw || '[]'), maxSeconds)
  } catch {
    return []
  }
}
