/**
 * Works out which ayat a recitation holds from the words the speech model
 * heard, and when each begins.
 *
 * The model transcribes what was actually said, so it is rarely word-perfect:
 * it spells in the everyday (imlaei) script rather than the mushaf's, drops or
 * swaps the odd word, and hears the taʿawwudh, basmalah, an "ameen" or a
 * repeated phrase that the Quran text does not have there. So this does not
 * look for exact quotations. It finds where in the Quran the first words
 * belong, then follows the recitation along the text, matching each heard
 * word to a close word just ahead (a miss costs nothing: the next word looks
 * again, a little wider), and starts over from a fresh search if it loses its
 * place. Pure functions over a word index, so it runs the same anywhere.
 */

export interface HeardWord {
  word: string
  start: number
  end: number
}

export interface IndexVerse {
  verse_key: string
  text_uthmani?: string
  words?: { char_type_name?: string; text_uthmani?: string; text_qpc_hafs?: string }[]
}

/** Every word of the Quran in reading order, normalised for comparison. */
export interface QuranWordIndex {
  norm: string[]
  verse: string[]
  /** 1-based position of each word inside its ayah. */
  position: number[]
  /** Index of each ayah's first word. */
  firstWord: Map<string, number>
  wordCount: Map<string, number>
  byWord: Map<string, number[]>
}

export function buildQuranWordIndex(verses: IndexVerse[], normalize: (text: string) => string): QuranWordIndex {
  const norm: string[] = []
  const verse: string[] = []
  const position: number[] = []
  const firstWord = new Map<string, number>()
  const wordCount = new Map<string, number>()
  const byWord = new Map<string, number[]>()

  const ordered = [...verses].sort((a, b) => {
    const [ca, va] = a.verse_key.split(':').map(Number)
    const [cb, vb] = b.verse_key.split(':').map(Number)
    return ca - cb || va - vb
  })
  for (const v of ordered) {
    const texts = v.words?.length
      ? v.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani || w.text_qpc_hafs || '')
      : (v.text_uthmani || '').split(/\s+/)
    let count = 0
    for (const text of texts) {
      const word = normalize(text)
      if (!word) continue
      if (count === 0) firstWord.set(v.verse_key, norm.length)
      count += 1
      const at = norm.length
      norm.push(word)
      verse.push(v.verse_key)
      position.push(count)
      const list = byWord.get(word)
      if (list) list.push(at)
      else byWord.set(word, [at])
    }
    wordCount.set(v.verse_key, count)
  }
  return { norm, verse, position, firstWord, wordCount, byWord }
}

/** 1 for the same word, 0 for a different one, and in between for a close spelling. */
function similarity(a: string, b: string): number {
  if (a === b) return 1
  const la = a.length
  const lb = b.length
  // Short words are too alike each other to allow a slip.
  if (Math.min(la, lb) <= 3 || Math.abs(la - lb) > 2) return 0
  let previous = Array.from({ length: lb + 1 }, (_, j) => j)
  for (let i = 1; i <= la; i++) {
    const row = [i]
    for (let j = 1; j <= lb; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = row
  }
  return 1 - previous[lb] / Math.max(la, lb)
}

const MATCH_AT_LEAST = 0.7
const ANCHOR_WORDS = 16
const COMMON_WORD = 300
const LOST_AFTER = 6
const BACK_MISSES = 2

interface Anchor {
  /** Quran word index minus heard word index: where heard word i should sit is offset + i. */
  offset: number
  hits: number
  weight: number
}

/** Where the heard words from `from` on most likely belong: the offset most of them agree on. */
function findAnchor(heard: string[], from: number, index: QuranWordIndex): Anchor | null {
  const votes: { offset: number; weight: number; word: number }[] = []
  for (let i = from; i < Math.min(heard.length, from + ANCHOR_WORDS); i++) {
    const places = index.byWord.get(heard[i])
    if (!places || places.length > COMMON_WORD) continue
    // A word found in few places says more about where we are than a common one.
    const weight = 1 / places.length
    for (const p of places) votes.push({ offset: p - i, weight, word: i })
  }
  if (votes.length === 0) return null
  votes.sort((a, b) => a.offset - b.offset)

  let best: Anchor | null = null
  let left = 0
  let weight = 0
  const inWindow = new Map<number, number>()
  for (let right = 0; right < votes.length; right++) {
    weight += votes[right].weight
    inWindow.set(votes[right].word, (inWindow.get(votes[right].word) ?? 0) + 1)
    // The offsets that agree are within a few words of each other (a heard word may be missing or extra).
    while (votes[right].offset - votes[left].offset > 12) {
      weight -= votes[left].weight
      const n = (inWindow.get(votes[left].word) ?? 1) - 1
      if (n <= 0) inWindow.delete(votes[left].word)
      else inWindow.set(votes[left].word, n)
      left += 1
    }
    if (inWindow.size >= 3 && (!best || weight > best.weight)) {
      best = { offset: Math.round((votes[left].offset + votes[right].offset) / 2), hits: inWindow.size, weight }
    }
  }
  return best && best.weight >= 1.1 ? best : null
}

export interface AyahMark {
  verseKey: string
  atSeconds: number
}

export interface WordMark {
  verseKey: string
  /** 1-based position of the word inside its ayah. */
  position: number
  start: number
  end: number
}

export interface AyahMarking {
  /** Where each ayah begins, in the order they were recited. */
  timeline: AyahMark[]
  /** Every heard word that was matched, with its place in the Quran. */
  words: WordMark[]
  matched: number
  heard: number
  /** matched / heard, 0–1. */
  coverage: number
}

/** A little before the word is heard, since a model places a word as it ends. */
const LEAD_SECONDS = 0.15

/**
 * The Quran word the heard word `word` most plausibly is, searching positions
 * `from`..`to` and preferring ones near `expected`; -1 when none is close.
 */
function bestMatch(word: string, index: QuranWordIndex, from: number, to: number, expected: number): number {
  let found = -1
  let foundScore = 0
  for (let p = Math.max(0, from); p <= Math.min(index.norm.length - 1, to); p++) {
    const sim = similarity(word, index.norm[p])
    if (sim < MATCH_AT_LEAST) continue
    // Closer to where the recitation should be wins between equal spellings.
    const score = sim - 0.004 * Math.abs(p - expected)
    if (score > foundScore) {
      foundScore = score
      found = p
    }
  }
  return found
}

/** Follows the recitation forward along the Quran text, finding its place afresh when lost. */
function followForward(heard: string[], index: QuranWordIndex): number[] {
  const assigned: number[] = new Array(heard.length).fill(-1)
  let expected = -1
  let misses = 0
  let anchoredAt = 0 // the heard word the current anchor began at
  let matchedSinceAnchor = 0
  for (let i = 0; i < heard.length; i++) {
    if (!heard[i]) continue
    // Words ahead of the first match (taʿawwudh, basmalah, a greeting) are not a sign of being lost.
    const lost = misses >= LOST_AFTER && (matchedSinceAnchor > 0 || i - anchoredAt >= ANCHOR_WORDS + 4)
    if (expected < 0 || lost) {
      const anchor = findAnchor(heard, i, index)
      if (anchor) {
        expected = anchor.offset + i
        misses = 0
        matchedSinceAnchor = 0
        anchoredAt = i
      } else if (expected < 0) {
        continue
      }
    }
    const found = bestMatch(heard[i], index, expected - 3 - misses * 2, expected + 25 + misses * 3, expected)
    if (found >= 0) {
      assigned[i] = found
      expected = found + 1
      misses = 0
      matchedSinceAnchor += 1
    } else {
      misses += 1
    }
  }
  return assigned
}

/** A match is believed only with company: another close by in both the heard words and the Quran. */
function dropStrays(assigned: number[]): void {
  const keep = assigned.map((p, i) => {
    if (p < 0) return false
    for (let j = Math.max(0, i - 3); j <= Math.min(assigned.length - 1, i + 3); j++) {
      if (j !== i && assigned[j] >= 0 && Math.abs(assigned[j] - p - (j - i)) <= 3) return true
    }
    return false
  })
  keep.forEach((k, i) => {
    if (!k) assigned[i] = -1
  })
}

interface Run {
  start: number
  end: number
}

/** Stretches of heard words matched to consecutive places in the Quran. */
function runsOf(assigned: number[]): Run[] {
  const runs: Run[] = []
  let last = -1
  for (let i = 0; i < assigned.length; i++) {
    if (assigned[i] < 0) continue
    const run = runs[runs.length - 1]
    if (run && i - last <= 3 && Math.abs(assigned[i] - assigned[last] - (i - last)) <= 3) run.end = i
    else runs.push({ start: i, end: i })
    last = i
  }
  return runs
}

/**
 * A recitation often opens with words that begin several ayat ("O you who
 * believe…"). When a short stretch landed in one such place and a much longer
 * one follows somewhere else, the short one is tried again, backwards from
 * the long one's start, and moved there if most of its words fit.
 */
function refitSmallRuns(heard: string[], index: QuranWordIndex, assigned: number[]): void {
  // Each refit can leave the stretch before it next to the long one, so go round until nothing moves.
  for (let pass = 0; pass < 5; pass++) if (!refitOnce(heard, index, assigned)) return
}

function refitOnce(heard: string[], index: QuranWordIndex, assigned: number[]): boolean {
  const runs = runsOf(assigned)
  for (let k = 0; k + 1 < runs.length; k++) {
    const small = runs[k]
    const long = runs[k + 1]
    const smallLength = small.end - small.start + 1
    const longLength = long.end - long.start + 1
    if (smallLength > 8 || longLength < 3 * smallLength) continue
    if (long.start - small.end > 8) continue

    const refit = new Map<number, number>()
    let expected = assigned[long.start] - 1
    let misses = 0
    for (let j = long.start - 1; j >= small.start && misses < LOST_AFTER; j--) {
      if (!heard[j]) continue
      const found = bestMatch(heard[j], index, expected - 25 - misses * 3, expected + 3 + misses * 2, expected)
      if (found >= 0) {
        refit.set(j, found)
        expected = found - 1
        misses = 0
      } else {
        misses += 1
      }
    }
    const changes = [...refit].some(([j, p]) => assigned[j] !== p)
    if (refit.size >= 2 && refit.size * 2 >= smallLength && changes) {
      for (let j = small.start; j < long.start; j++) assigned[j] = refit.get(j) ?? -1
      return true
    }
    // Two or three words that fit nowhere near, ahead of a long stretch elsewhere, were a chance match
    // (words of the taʿawwudh or a greeting that also occur in the Quran).
    if (smallLength <= 3) {
      for (let j = small.start; j <= small.end; j++) assigned[j] = -1
      return true
    }
  }
  return false
}

/**
 * Goes back over the words ahead of each stretch that was found: the follow
 * pass can only reach them once it has its bearings, so what came before that
 * (the first words of the first ayah, after the taʿawwudh and basmalah) is
 * matched backwards from the first word it was sure of.
 */
function extendBackward(heard: string[], index: QuranWordIndex, assigned: number[]): void {
  for (let start = 0; start < heard.length; start++) {
    if (assigned[start] < 0 || (start > 0 && assigned[start - 1] >= 0)) continue
    let expected = assigned[start] - 1
    let misses = 0
    for (let j = start - 1; j >= 0 && misses < BACK_MISSES; j--) {
      if (assigned[j] >= 0) break
      if (!heard[j]) continue
      // Tighter than going forward: the words behind a stretch are only believed when they sit right against it.
      const found = bestMatch(heard[j], index, expected - 8 - misses * 2, expected + 2 + misses, expected)
      if (found >= 0) {
        assigned[j] = found
        expected = found - 1
        misses = 0
      } else {
        misses += 1
      }
    }
  }
}

export function markAyat(heardWords: HeardWord[], index: QuranWordIndex, normalize: (text: string) => string): AyahMarking {
  const heard = heardWords.map((w) => normalize(w.word))
  const assigned = followForward(heard, index)
  dropStrays(assigned)
  refitSmallRuns(heard, index, assigned)
  extendBackward(heard, index, assigned)

  // Runs of words in the same ayah.
  interface Group {
    verseKey: string
    first: number
    count: number
    /** Quran word index of its first and last word. */
    from: number
    to: number
  }
  const groups: Group[] = []
  for (let i = 0; i < assigned.length; i++) {
    if (assigned[i] < 0) continue
    const verseKey = index.verse[assigned[i]]
    const last = groups[groups.length - 1]
    // Going back inside the same ayah is the reciter saying it again, not more of the same pass.
    if (last && last.verseKey === verseKey && assigned[i] > last.to - 2) {
      last.count += 1
      last.to = Math.max(last.to, assigned[i])
    } else {
      groups.push({ verseKey, first: i, count: 1, from: assigned[i], to: assigned[i] })
    }
  }

  // A lone word is believed only if it is the next ayah along, or the ayah is that short.
  let kept: Group[] = []
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]
    const previous = kept[kept.length - 1]
    const isNext = previous ? nextVerseKey(previous.verseKey, index) === group.verseKey : false
    // A lone, uncommon word right before the next ayah is probably that ayah's own beginning.
    const rare = (index.byWord.get(index.norm[group.from])?.length ?? 999) <= 60
    const leadsNext = rare && groups[g + 1] ? nextVerseKey(group.verseKey, index) === groups[g + 1].verseKey : false
    const short = (index.wordCount.get(group.verseKey) ?? 9) <= 2
    if (group.count >= 2 || isNext || leadsNext || short) kept.push(group)
  }
  // A few words from an ayah that the recitation then goes back before are a stray match, not an ayah.
  kept = kept.filter((group, i) => {
    const next = kept[i + 1]
    return !(next && group.count <= 3 && next.from < group.from && next.count >= 2 * group.count)
  })
  // Pieces of one ayah split by a stray word in between are one ayah again.
  const merged: Group[] = []
  for (const group of kept) {
    const previous = merged[merged.length - 1]
    if (previous && previous.verseKey === group.verseKey && (group.from > previous.to - 2 || group.count <= 2)) {
      previous.count += group.count
      previous.to = Math.max(previous.to, group.to)
    } else {
      merged.push({ ...group })
    }
  }
  kept = merged

  // The basmalah is the first ayah of the Fatiha, but before any other surah it is not part of it.
  if (kept.length >= 2 && kept[0].verseKey === '1:1' && kept[1].verseKey.split(':')[0] !== '1') kept.shift()

  const timeline: AyahMark[] = []
  for (const group of kept) {
    const at = Math.max(0, heardWords[group.first].start - LEAD_SECONDS)
    const previous = timeline[timeline.length - 1]
    timeline.push({ verseKey: group.verseKey, atSeconds: Math.round(Math.max(at, previous ? previous.atSeconds + 0.1 : 0) * 10) / 10 })
  }

  const keptWords = new Set<number>()
  for (const group of kept) {
    let n = 0
    for (let i = group.first; n < group.count && i < assigned.length; i++) {
      if (assigned[i] >= 0 && index.verse[assigned[i]] === group.verseKey) {
        keptWords.add(i)
        n += 1
      }
    }
  }

  const words: WordMark[] = [...keptWords]
    .sort((a, b) => a - b)
    .map((i) => ({
      verseKey: index.verse[assigned[i]],
      position: index.position[assigned[i]],
      start: heardWords[i].start,
      end: heardWords[i].end,
    }))

  const matched = words.length
  const counted = heard.filter(Boolean).length
  return { timeline, words, matched, heard: counted, coverage: counted ? matched / counted : 0 }
}

function nextVerseKey(key: string, index: QuranWordIndex): string | null {
  const [chapter, verse] = key.split(':').map(Number)
  const same = `${chapter}:${verse + 1}`
  if (index.wordCount.has(same)) return same
  const nextChapter = `${chapter + 1}:1`
  return index.wordCount.has(nextChapter) ? nextChapter : null
}
