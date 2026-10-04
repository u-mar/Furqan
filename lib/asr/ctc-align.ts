/**
 * Exactly when each word of an ayah is said, once it is known which ayah it
 * is: CTC forced alignment. Listening alone ("what did you hear?") misses
 * words and places each by where the model happened to be surest; here the
 * model is asked instead "these exact words were recited — where does each
 * one start?", using the scores it already gave every sound in the recording.
 * Every word gets a time, skipped ones included, and stretched vowels and
 * pauses do not throw it, because what comes next is known.
 *
 * Pure: no model, no DOM. The recognizer keeps its per-step scores
 * (`Emissions`); lib/qari-ayah-marks.ts runs this over each marked ayah.
 */

/** The model's scores for one stretch of the recording: log-probabilities, `steps` × `vocab`. */
export interface EmissionPiece {
  /** Where the stretch starts in the recording, in seconds. */
  start: number
  /** Audio each step stands for, in seconds. */
  stepSeconds: number
  steps: number
  vocab: number
  /** Normalised log-probabilities, row by row. */
  logprobs: Float32Array
}

export type Emissions = EmissionPiece[]

/**
 * The model writes the Quran in the plain modern spelling with its vowels
 * (مَالِكِ, الْمُسْتَقِيمَ), not the mushaf's Uthmani one (مَـٰلِكِ,
 * ٱلْمُسْتَقِيمَ), so the ayah is respelt before its words are looked up in
 * the model's vocabulary: the vowels kept, the mushaf's own signs turned into
 * their plain equivalents or dropped. A few words keep a spelling the model
 * would not use (هَاذَا for هَذَا); alignment tolerates that.
 */
export function toModelSpelling(uthmani: string): string {
  return (
    uthmani
      // A small alef standing for a long ā is written out — but not on ى, where it is already long.
      .replace(/ىٰ/g, 'ى')
      .replace(/ـٰ/g, 'ا')
      .replace(/ٰ/g, 'ا')
      // Hamza then a long ā, written ـَٔا or ءَا in the mushaf, is آ (ٱلْـَٔاخِرِ → الْآخِرِ, ءَامَنُوا → آمَنُوا).
      .replace(/ـ?(?:َٔ?|َٔ)ا/g, 'آ')
      .replace(/ءَا/g, 'آ')
      // Alef wasla is a plain alef.
      .replace(/ٱ/g, 'ا')
      // The mushaf's round sukun and its tanween forms, as the plain marks.
      .replace(/ۡ/g, 'ْ')
      .replace(/ࣰ/g, 'ً')
      .replace(/ࣱ/g, 'ٌ')
      .replace(/ࣲ/g, 'ٍ')
      // Madda, hamza marks, small letters, pause and recitation signs, tatweel.
      .replace(/[ٓ-ٟۖ-ۭـ‌-‏]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

export interface WordTokenizer {
  /** The vocabulary ids spelling one word (with its word-start marker), or null if it cannot be spelt. */
  encodeWord(word: string): number[] | null
}

/**
 * One mushaf word in the model's vocabulary. A few are stored as two pieces
 * (بَعْدَ مَا), each spelt as the word it is. Null if any letter has no piece.
 */
export function spellForModel(uthmani: string, tokenizer: WordTokenizer): number[] | null {
  const ids: number[] = []
  for (const part of toModelSpelling(uthmani).split(' ').filter(Boolean)) {
    const spelt = tokenizer.encodeWord(part)
    if (!spelt) return null
    ids.push(...spelt)
  }
  return ids.length ? ids : null
}

interface Aligned {
  /** When each word starts, in seconds; one per word. */
  starts: number[]
  /** Average log-probability of the steps given to the words: how well the text fits the sound (0 is perfect). */
  score: number
}

/**
 * Where each of `words` (the ayah's words, in order, each as vocabulary ids)
 * starts, looking only at the recording between `from` and `to` seconds. The
 * words may start anywhere in that window and need not fill it, so a window
 * cut generously round the ayah is fine. Null when nothing fits.
 */
export function alignWords(emissions: Emissions, from: number, to: number, words: number[][], blank: number): Aligned | null {
  // The steps in the window, from every piece of the recording it touches.
  const rows: { piece: EmissionPiece; step: number; time: number }[] = []
  for (const piece of emissions) {
    const first = Math.max(0, Math.floor((from - piece.start) / piece.stepSeconds))
    const last = Math.min(piece.steps - 1, Math.ceil((to - piece.start) / piece.stepSeconds))
    for (let step = first; step <= last; step++) rows.push({ piece, step, time: piece.start + step * piece.stepSeconds })
  }

  // Tokens in order, remembering which word each belongs to.
  const tokens: number[] = []
  const wordOf: number[] = []
  words.forEach((ids, w) => {
    for (const id of ids) {
      tokens.push(id)
      wordOf.push(w)
    }
  })
  const T = rows.length
  const L = tokens.length
  if (L === 0 || T < L) return null

  // States: blank, token 0, blank, token 1, … blank.
  const S = 2 * L + 1
  const label = (s: number) => (s % 2 === 0 ? blank : tokens[(s - 1) >> 1])
  const NEG = -1e30

  // Steps before and after the words (the end of the ayah before, the start of
  // the one after) are not forced to be silence: each is scored as whatever the
  // model thought likeliest there. A word then cannot gain by starting a step
  // later or ending a step sooner, which free edges would reward.
  const garbage = new Float64Array(T)
  for (let t = 0; t < T; t++) {
    const { piece, step } = rows[t]
    const row = step * piece.vocab
    let max = NEG
    for (let v = 0; v < piece.vocab; v++) if (piece.logprobs[row + v] > max) max = piece.logprobs[row + v]
    garbage[t] = max
  }
  const after = new Float64Array(T + 1)
  for (let t = T - 1; t >= 0; t--) after[t] = after[t + 1] + garbage[t]

  let prev = new Float64Array(S).fill(NEG)
  let curr = new Float64Array(S)
  // Where each state came from: 0 stay, 1 from the state before, 2 skipping a blank, 3 starting here.
  const back = new Uint8Array(T * S)
  let before = 0
  let best = NEG
  let bestT = -1
  let bestS = -1

  for (let t = 0; t < T; t++) {
    const { piece, step } = rows[t]
    const row = step * piece.vocab
    for (let s = 0; s < S; s++) {
      let score = prev[s]
      let came = 0
      if (s > 0 && prev[s - 1] > score) {
        score = prev[s - 1]
        came = 1
      }
      if (s > 1 && s % 2 === 1 && tokens[(s - 1) >> 1] !== tokens[(s - 3) >> 1] && prev[s - 2] > score) {
        score = prev[s - 2]
        came = 2
      }
      // Starting here, after the steps before the words.
      if (s <= 1 && before > score) {
        score = before
        came = 3
      }
      curr[s] = score <= NEG / 2 ? NEG : score + piece.logprobs[row + label(s)]
      back[t * S + s] = came
    }
    for (const end of [S - 1, S - 2]) {
      const total = curr[end] + after[t + 1]
      if (total > best) {
        best = total
        bestT = t
        bestS = end
      }
    }
    before += garbage[t]
    const swap = prev
    prev = curr
    curr = swap
  }
  if (bestT < 0 || best <= NEG / 2) return null

  // Back through the path: the first step of each word's first token is when the word starts.
  const starts = new Array<number>(words.length).fill(NaN)
  let pathScore = 0
  let pathSteps = 0
  let s = bestS
  for (let t = bestT; t >= 0; t--) {
    const { piece, step } = rows[t]
    pathScore += piece.logprobs[step * piece.vocab + label(s)]
    pathSteps += 1
    if (s % 2 === 1) starts[wordOf[(s - 1) >> 1]] = rows[t].time
    const came = back[t * S + s]
    if (came === 3) break
    if (came === 1) s -= 1
    else if (came === 2) s -= 2
  }
  if (starts.some((v) => !Number.isFinite(v))) return null
  return { starts, score: pathScore / Math.max(1, pathSteps) }
}
