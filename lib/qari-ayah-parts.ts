/**
 * Ayat in the swipe view and the shared video, a phrase at a time, on one
 * line: each ayah is cut where the mushaf marks a pause (the waqf signs), and
 * a stretch longer than a few words is cut again into even pieces. The phrase
 * on screen is the one holding the word being recited: when the reciter
 * starts the first word of the next one, it takes over, with the translation
 * of just those words.
 *
 * When each word starts comes from the marking (lib/asr/quran-match.ts).
 * Recitations marked before that was kept are paced evenly through the time
 * the ayah takes instead.
 */

import type { VerseTimelineEntry } from '@/lib/qari'

/** Words on the line at most, so a phrase reads at a glance. */
const PHRASE_WORDS = 5

export interface AyahPart {
  /** First and last word, counted from 0. */
  start: number
  end: number
}

/** The phrases an ayah is shown in, from where it pauses (`pauseAfter`, one entry per word). */
export function ayahParts(pauseAfter: boolean[]): AyahPart[] {
  const words = pauseAfter.length
  if (words === 0) return [{ start: 0, end: 0 }]
  const parts: AyahPart[] = []
  let from = 0
  for (let i = 0; i < words; i++) {
    if (!pauseAfter[i] && i < words - 1) continue
    // Between two pauses: as it is, or in even pieces when it is long.
    const length = i - from + 1
    const pieces = Math.ceil(length / PHRASE_WORDS)
    for (let k = 0; k < pieces; k++) {
      parts.push({ start: from + Math.round((k * length) / pieces), end: from + Math.round(((k + 1) * length) / pieces) - 1 })
    }
    from = i + 1
  }
  return parts
}

/**
 * The word being recited at `position` (counted from 0), in an ayah of
 * `words` words that starts at `entry` and runs until `endsAt`.
 */
export function wordAt(entry: VerseTimelineEntry, endsAt: number, position: number, words: number): number {
  const times = entry.words
  if (times && times.length > 0) {
    let current = 0
    for (let i = 0; i < times.length && i < words; i++) {
      if (times[i] > position) break
      current = i
    }
    return current
  }
  const span = endsAt - entry.atSeconds
  if (!(span > 0)) return 0
  const fraction = (position - entry.atSeconds) / span
  return Math.max(0, Math.min(words - 1, Math.floor(fraction * words)))
}

/** Which of `parts` holds word `word`. */
export function partFor(parts: AyahPart[], word: number): number {
  for (let k = parts.length - 1; k > 0; k--) if (word >= parts[k].start) return k
  return 0
}

const partTranslations = new Map<string, Promise<string | null>>()

/**
 * The translation of words `start`–`end` of an ayah, cut from the published
 * translation of the whole ayah (see lib/part-translation.ts). Null when none
 * could be found.
 */
export function loadPartTranslation(verseKey: string, edition: string, part: AyahPart): Promise<string | null> {
  const key = `${edition}|${verseKey}|${part.start}|${part.end}`
  let pending = partTranslations.get(key)
  if (!pending) {
    pending = (async () => {
      try {
        const params = new URLSearchParams({
          type: 'part-translation',
          verse: verseKey,
          edition,
          start: String(part.start),
          end: String(part.end),
        })
        const res = await fetch(`/api/ayah?${params.toString()}`)
        if (!res.ok) throw new Error('part translation failed')
        const data = (await res.json()) as { text?: string | null }
        return data.text?.trim() || null
      } catch {
        // Tried again the next time it is needed.
        partTranslations.delete(key)
        return null
      }
    })()
    partTranslations.set(key, pending)
  }
  return pending
}
