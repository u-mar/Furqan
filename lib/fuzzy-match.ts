/**
 * Forgiving text matching for Qari's search: close enough counts, not only the exact letters.
 * "fatiha" finds "Al-Fatihah", "abdirahman" finds "Abdi Rahmaan", "tajwid" finds "#tajweed",
 * and Arabic is compared without its vowel marks.
 */

/** Arabic vowel marks, Quranic annotation signs and the tatweel: not part of how a word is spelled. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g

/** Lower case, accents and Arabic marks removed, alef and other letter forms made one, and words split. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function words(text: string): string[] {
  const normal = normalizeText(text)
  return normal ? normal.split(' ') : []
}

/** Spelling variants that are the same name: doubled letters, a final h, ee/oo for i/u. */
function skeleton(word: string): string {
  return word
    .replace(/(.)\1+/g, '$1')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/h$/, '')
}

/** Edit distance, stopped early once it is past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      row.push(value)
      if (value < best) best = value
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

/** How many typing mistakes a word of this length may have and still match. */
function allowedMistakes(length: number): number {
  return length <= 3 ? 0 : length <= 6 ? 1 : 2
}

/** How well one typed word matches one word of the text, 0 (not at all) to 1 (the same). */
function wordScore(typed: string, word: string): number {
  if (word === typed) return 1
  if (word.startsWith(typed)) return typed.length >= 2 ? 0.9 : 0.5
  if (typed.length >= 3 && word.includes(typed)) return 0.7
  const a = skeleton(typed)
  const b = skeleton(word)
  if (a === b) return 0.9
  if (a.length >= 3 && b.startsWith(a)) return 0.8
  const max = allowedMistakes(a.length)
  // A slip of the finger keeps the first letter: "surah" is not a misspelt "murattal".
  if (max === 0 || a[0] !== b[0]) return 0
  const whole = distance(a, b, max)
  if (whole <= max) return 0.75 - whole * 0.1
  // A mistake in the part typed so far: "fatiah" for "fatihah".
  if (b.length > a.length) {
    const start = distance(a, b.slice(0, a.length), max)
    if (start <= max) return 0.6 - start * 0.1
  }
  return 0
}

export interface SearchField {
  text: string
  /** How much a match here counts: a name or a title more than a tag. */
  weight: number
}

/**
 * How well a search matches a thing described by these fields: 0 when it does not, up to about
 * 1. Every typed word has to match something (one may miss in a search of three words or more).
 * Words run together also count: "alfatiha" matches "Al Fatihah".
 */
export function matchScore(query: string, fields: SearchField[]): number {
  const typed = words(query)
  if (typed.length === 0) return 0
  const bag: { word: string; weight: number }[] = []
  const joined: { text: string; weight: number }[] = []
  for (const field of fields) {
    const ws = words(field.text)
    for (const word of ws) bag.push({ word, weight: field.weight })
    if (ws.length > 1) joined.push({ text: ws.join(''), weight: field.weight })
  }
  if (bag.length === 0) return 0

  let total = 0
  let missed = 0
  for (const t of typed) {
    let best = 0
    for (const { word, weight } of bag) {
      const score = wordScore(t, word) * weight
      if (score > best) best = score
      if (best >= weight) break
    }
    if (best < 0.85 && t.length >= 4) {
      for (const { text, weight } of joined) {
        if (text.includes(skeleton(t)) || text.includes(t)) best = Math.max(best, 0.7 * weight)
      }
    }
    if (best === 0) missed += 1
    total += best
  }
  if (missed > (typed.length >= 3 ? 1 : 0)) return 0
  // The whole search typed as it appears scores above the same words found apart.
  const phrase = normalizeText(query)
  const exactBonus = fields.some((f) => normalizeText(f.text).includes(phrase)) ? 0.15 : 0
  return total / typed.length + exactBonus
}
