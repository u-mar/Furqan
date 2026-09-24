import type { Verse } from '@/types'
import { getVerseArabicText } from '@/lib/quran-display'

/**
 * Ayah search — match what someone types or, once transcribed, says against
 * the Quran regardless of the diacritics (tashkeel) and the handful of
 * letters people type interchangeably: nobody typing from memory reliably
 * picks ta marbuta vs ha, or alef with or without hamza.
 *
 * Unicode ranges here are built from code points with `charRange`, not typed
 * as literal characters or `\u` escapes in a character class — both have
 * silently turned into the wrong thing before (an editing step can normalize
 * escapes into characters, and a stray copy-paste is invisible in a class
 * that already mixes ranges and single characters). Building the class from
 * numbers means what's matched can be read straight off the hex.
 */

function charRange(start: number, end: number): string {
  let out = ''
  for (let code = start; code <= end; code += 1) out += String.fromCharCode(code)
  return out
}

// Quranic annotation signs (U+0610–U+061A), Arabic diacritics — fathatan
// through the small high marks (U+064B–U+065F) — the Quranic end-of-ayah /
// sajdah marks (U+06D6–U+06ED), and tatweel (U+0640).
const DIACRITICS_CHARS =
  charRange(0x0610, 0x061a) + charRange(0x064b, 0x065f) + charRange(0x06d6, 0x06ed) + String.fromCharCode(0x0640)
const DIACRITICS_RE = new RegExp(`[${DIACRITICS_CHARS}]`, 'g')

// The "dagger alef" (U+0670, a superscript ا as in ٱلْعَـٰلَمِينَ) reads as a
// real letter in some words (العالمين is commonly typed with the alef) and
// as pure decoration in others (موسى has no extra letter after the ى however
// it's typed). There's no one rule that's right for both, so it's dropped
// like any other diacritic rather than guessed at; the fuzzy matching below
// is what recovers the words this choice gets "wrong".
const DAGGER_ALEF_RE = new RegExp(String.fromCharCode(0x0670), 'g')

// Keep only the Arabic block (U+0600–U+06FF) and whitespace.
const NON_ARABIC_RE = new RegExp(`[^${charRange(0x0600, 0x06ff)}\\s]`, 'g')

function foldLetters(text: string): string {
  return text
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
}

export function normalizeArabic(text: string): string {
  return foldLetters(text.replace(DIACRITICS_RE, '').replace(DAGGER_ALEF_RE, ''))
    .replace(NON_ARABIC_RE, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface AyahSearchResult {
  verseKey: string
  arabic: string
}

interface IndexEntry {
  verseKey: string
  arabic: string
  normalized: string
  words: string[]
}

interface Index {
  entries: IndexEntry[]
  /** How many verses each normalized word appears in — common words (لا، ان، كفروا) count for much less than a rare one like "عاد". */
  docFrequency: Map<string, number>
}

/** Built once per full Quran load (the same `verses` array every caller already has cached). */
let indexedFor: Verse[] | null = null
let cachedIndex: Index = { entries: [], docFrequency: new Map() }

function ensureIndex(verses: Verse[]): Index {
  if (indexedFor === verses) return cachedIndex
  const docFrequency = new Map<string, number>()
  const entries = verses.map((verse) => {
    const arabic = getVerseArabicText(verse, { omitEndMark: true })
    const normalized = normalizeArabic(arabic)
    const words = normalized.split(' ').filter(Boolean)
    for (const word of new Set(words)) docFrequency.set(word, (docFrequency.get(word) ?? 0) + 1)
    return { verseKey: verse.verse_key, arabic, normalized, words }
  })
  indexedFor = verses
  cachedIndex = { entries, docFrequency }
  return cachedIndex
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const al = a.length
  const bl = b.length
  if (al === 0) return bl
  if (bl === 0) return al
  let prev = Array.from({ length: bl + 1 }, (_, i) => i)
  for (let i = 1; i <= al; i += 1) {
    const curr = [i]
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[bl]
}

/**
 * Whether two normalized words are "the same word" for search purposes —
 * exact, or a one-or-two-letter slip a real transcription/typo makes, like
 * "عاد" heard back without the "عادا" case ending. Words of three letters or
 * fewer never fuzz: at that length half the Quran's function words are one
 * edit apart from each other, so tolerance there just invents false matches.
 */
export function wordsAreClose(a: string, b: string): boolean {
  if (a === b) return true
  const maxLen = Math.max(a.length, b.length)
  if (maxLen <= 3) return false
  const tolerance = maxLen <= 6 ? 1 : 2
  return Math.abs(a.length - b.length) <= tolerance && levenshtein(a, b) <= tolerance
}

/**
 * Speech recognition (and the occasional typo) rarely gets every word right.
 * An exact-substring match stays the first attempt, since it is the most
 * precise signal when the whole phrase really is verbatim. Failing that,
 * verses are scored by how much of the query's *distinctive* content they
 * contain — matching "عاد" (rare) counts for far more than matching "لا" or
 * "كفروا" (common to hundreds of verses), so a phrase built mostly of common
 * words doesn't drown out the one word that actually identifies the ayah.
 */
const MIN_SCORE = 0.6
const MIN_QUERY_WORDS_FOR_FUZZY = 2

export function searchAyahs(verses: Verse[], query: string, limit = 30): AyahSearchResult[] {
  const q = normalizeArabic(query)
  if (!q) return []
  const { entries, docFrequency } = ensureIndex(verses)

  const exact: AyahSearchResult[] = []
  for (const entry of entries) {
    if (entry.normalized.includes(q)) {
      exact.push({ verseKey: entry.verseKey, arabic: entry.arabic })
      if (exact.length >= limit) break
    }
  }
  if (exact.length > 0) return exact

  const queryWords = [...new Set(q.split(' ').filter(Boolean))]
  if (queryWords.length < MIN_QUERY_WORDS_FOR_FUZZY) return []

  const idf = (word: string) => Math.log((entries.length + 1) / ((docFrequency.get(word) ?? 0) + 1) + 1)
  const totalIdf = queryWords.reduce((sum, word) => sum + idf(word), 0)

  const scored: { entry: IndexEntry; score: number }[] = []
  for (const entry of entries) {
    if (entry.words.length === 0) continue
    const entrySet = new Set(entry.words)
    let matchedIdf = 0
    const unmatched: string[] = []
    for (const word of queryWords) {
      if (entrySet.has(word)) matchedIdf += idf(word)
      else unmatched.push(word)
    }
    if (matchedIdf === 0) continue
    // Fuzzy pass only runs for verses that already share a real word with
    // the query — comparing every query word against every word of all
    // 6,236 verses would be needless work for the vast majority that share
    // nothing at all.
    for (const word of unmatched) {
      if (entry.words.some((entryWord) => wordsAreClose(word, entryWord))) matchedIdf += idf(word)
    }
    const score = matchedIdf / totalIdf
    if (score >= MIN_SCORE) scored.push({ entry, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map(({ entry }) => ({ verseKey: entry.verseKey, arabic: entry.arabic }))
}
