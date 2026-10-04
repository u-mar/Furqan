/**
 * Turns the ayat found by listening (lib/asr/quran-match.ts) into exact word
 * times, by lining each ayah's known text up with the recording
 * (lib/asr/ctc-align.ts) — and finds the ayat listening missed: where an ayah
 * is skipped between two that were found, or the recitation clearly began a
 * few ayat before the first one found, those ayat are tried in the gap and
 * kept if their text fits the sound.
 *
 * Pure: the caller supplies the model's scores, the ayat in order and how to
 * spell each one's words in the model's vocabulary.
 */

import { alignWords, type Emissions } from './ctc-align'

export interface TimelineEntry {
  verseKey: string
  atSeconds: number
  words?: number[]
}

export interface AyahSource {
  /** Every ayah key, in mushaf order. */
  order: string[]
  /** The ayah's words in the model's vocabulary, or null if one cannot be spelt. */
  words(verseKey: string): number[][] | null
}

/** How far ahead of the sound a word is shown, so it never lags the voice. */
const WORD_LEAD = 0.1
/**
 * Below this average log-probability the text does not fit the sound well
 * enough to trust (the reciter stopped partway, or the ayah was marked
 * wrongly), and the times from listening are kept.
 */
const MIN_SCORE = -2.5
/** A missed ayah is only added on a much better fit than that: it was not heard at all. */
const MIN_FOUND_SCORE = -1.2
/** At most this many missed ayat are looked for in one gap. */
const MAX_MISSING = 6

const round = (n: number) => Math.round(n * 100) / 100
const surahOf = (key: string) => key.split(':')[0]

/** Aligns a run of consecutive ayat as one, so they share out the stretch between them. */
function alignRun(
  emissions: Emissions,
  keys: string[],
  source: AyahSource,
  from: number,
  to: number,
  blank: number
): { entries: TimelineEntry[]; score: number } | null {
  const perAyah = keys.map((k) => source.words(k))
  if (perAyah.some((w) => !w || w.length === 0)) return null
  const all = (perAyah as number[][][]).flat()
  const aligned = alignWords(emissions, from, to, all, blank)
  if (!aligned) return null
  const entries: TimelineEntry[] = []
  let at = 0
  keys.forEach((verseKey, k) => {
    const count = (perAyah[k] as number[][]).length
    const words = aligned.starts.slice(at, at + count).map((t) => round(Math.max(0, t - WORD_LEAD)))
    at += count
    entries.push({ verseKey, atSeconds: words[0], words })
  })
  return { entries, score: aligned.score }
}

export function alignRecitation(
  timeline: TimelineEntry[],
  emissions: Emissions,
  durationSec: number,
  source: AyahSource,
  blank: number
): TimelineEntry[] {
  if (!emissions.length || !timeline.length) return timeline
  const position = new Map(source.order.map((k, i) => [k, i]))

  // Each ayah that was found, on its own stretch: from just before it to just
  // after the next begins, never reaching halfway into its neighbours (a
  // repeated ayah must not find its other recitation).
  const found: TimelineEntry[] = timeline.map((entry, i) => {
    const previous = timeline[i - 1]
    const next = timeline[i + 1]
    const afterNext = timeline[i + 2]
    const from = Math.max(entry.atSeconds - 1.5, previous ? (previous.atSeconds + entry.atSeconds) / 2 : 0)
    const end = next ? next.atSeconds : durationSec
    const to = Math.min(end + 1.5, next && afterNext ? (next.atSeconds + afterNext.atSeconds) / 2 : end + 1.5)
    const run = alignRun(emissions, [entry.verseKey], source, from, to, blank)
    return run && run.score >= MIN_SCORE ? run.entries[0] : entry
  })

  // The ayat between two found ones (or before the first) that were not heard.
  const missingBefore = (i: number): string[] => {
    const here = position.get(found[i].verseKey)
    if (here === undefined) return []
    const keys: string[] = []
    const previous = i > 0 ? position.get(found[i - 1].verseKey) : undefined
    for (let p = here - 1; p >= 0 && keys.length < MAX_MISSING; p--) {
      const key = source.order[p]
      if (surahOf(key) !== surahOf(found[i].verseKey)) break
      if (previous !== undefined && p <= previous) break
      keys.unshift(key)
    }
    // Between two found ayat, only when the earlier one really comes before.
    if (previous !== undefined && (previous >= here || surahOf(found[i - 1].verseKey) !== surahOf(found[i].verseKey))) return []
    return keys
  }

  const out: TimelineEntry[] = []
  for (let i = 0; i < found.length; i++) {
    const keys = missingBefore(i)
    if (keys.length) {
      const before = out[out.length - 1]
      const from = before ? (before.words?.[before.words.length - 1] ?? before.atSeconds) + 0.3 : 0
      const to = found[i].atSeconds + 0.5
      // The longest run that fits, dropping the earliest ayat first: a recitation
      // may well begin partway through what is missing.
      for (let start = 0; start < keys.length; start++) {
        const run = alignRun(emissions, keys.slice(start), source, from, to, blank)
        if (run && run.score >= MIN_FOUND_SCORE) {
          out.push(...run.entries)
          break
        }
      }
    }
    out.push(found[i])
  }

  // In order, a little apart, and every word at or after its ayah's start.
  for (let i = 0; i < out.length; i++) {
    const before = out[i - 1]
    const atSeconds = round(Math.max(out[i].atSeconds, before ? before.atSeconds + 0.1 : 0))
    out[i] = { ...out[i], atSeconds, ...(out[i].words ? { words: out[i].words!.map((w) => Math.max(w, atSeconds)) } : {}) }
  }
  return out
}
