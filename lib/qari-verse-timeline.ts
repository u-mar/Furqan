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

/** How far an ayah's start may reach back into the words of the one before it, in seconds. */
const OVERLAP_ALLOWED_S = 0.3

/**
 * Ayah marks in order, without the false ones: a mark that starts while the ayah before it is
 * still being recited (before that ayah's last word) did not happen. The automatic marking
 * sometimes adds one at the end, such as an ayah 65 the reciter never reached, starting in the
 * middle of ayah 64; left in, the recitation showed it over the end of the real one.
 */
export function dropOverlappingAyat<T extends { atSeconds: number; words?: number[] }>(timeline: readonly T[]): T[] {
  const kept: T[] = []
  for (const entry of [...timeline].sort((a, b) => a.atSeconds - b.atSeconds)) {
    const previous = kept[kept.length - 1]
    const lastWord = previous?.words?.length ? previous.words[previous.words.length - 1] : null
    if (lastWord !== null && entry.atSeconds < lastWord - OVERLAP_ALLOWED_S) continue
    kept.push(entry)
  }
  return kept
}

/** `value` as ayah marks within a recording `maxSeconds` long; [] if it is not that. */
export function sanitizeVerseTimeline(value: unknown, maxSeconds: number): VerseTimelineMark[] {
  if (!Array.isArray(value)) return []
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(maxSeconds, n)) * 100) / 100
  const marks = value
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
  return dropOverlappingAyat(marks)
}

/** The same, from the JSON text a form sends. */
export function parseVerseTimeline(raw: string, maxSeconds: number): VerseTimelineMark[] {
  try {
    return sanitizeVerseTimeline(JSON.parse(raw || '[]'), maxSeconds)
  } catch {
    return []
  }
}
