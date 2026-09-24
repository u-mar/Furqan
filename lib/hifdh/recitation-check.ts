import { normalizeArabic, wordsAreClose } from '@/lib/search-ayahs'

/**
 * Scores a transcribed recitation against the ayah it was supposed to be —
 * how much of the ayah's own words showed up in what was heard, exact or a
 * close (edit-distance) match, tolerant of the odd mis-transcribed word the
 * same way ayah search already is. This is a placeholder for real
 * pronunciation checking (a Quran-tuned ASR model with a mistake-detection
 * head) — it only tells you whether roughly the right words were said, not
 * whether they were pronounced correctly. Swapping in the real model later
 * only changes what produces `transcript`; this scoring stays the same.
 */

export interface RecitationCheck {
  /** Fraction (0–1) of the expected ayah's words heard. */
  score: number
  passed: boolean
}

const PASS_THRESHOLD = 0.6

export function checkRecitation(transcript: string, expectedArabic: string): RecitationCheck {
  const heardWords = normalizeArabic(transcript).split(' ').filter(Boolean)
  const expectedWords = normalizeArabic(expectedArabic).split(' ').filter(Boolean)
  if (expectedWords.length === 0 || heardWords.length === 0) {
    return { score: 0, passed: false }
  }

  const heardSet = new Set(heardWords)
  let matched = 0
  for (const word of expectedWords) {
    if (heardSet.has(word) || heardWords.some((heard) => wordsAreClose(word, heard))) matched += 1
  }

  const score = matched / expectedWords.length
  return { score, passed: score >= PASS_THRESHOLD }
}
