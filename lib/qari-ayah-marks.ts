'use client'

import { decodeRecording, recognize, type Recognition } from '@/lib/asr/offline-recognizer'
import { DEFAULT_FEATURE_SETTINGS, loadFeatureSettings, saveFeatureSettings } from '@/lib/asr/offline-features'
import { buildQuranWordIndex, markAyat, type AyahMarking, type QuranWordIndex } from '@/lib/asr/quran-match'
import { loadQuranData } from '@/lib/quran'
import { normalizeArabic } from '@/lib/search-ayahs'
import type { VerseTimelineEntry } from '@/lib/qari'

/**
 * Finds the ayat in a Qari recording by listening to it on the phone (the
 * offline Quran speech model) and matching what was heard to the Quran text.
 * Gives the same list the "Read from Mushaf" overlay makes by hand, so the
 * swipe view and share videos can show each ayah as it is recited.
 */

let indexPromise: Promise<QuranWordIndex> | null = null

function quranIndex(): Promise<QuranWordIndex> {
  if (!indexPromise) {
    indexPromise = loadQuranData()
      .then((data) => buildQuranWordIndex(data.verses, normalizeArabic))
      .catch((err) => {
        indexPromise = null
        throw err
      })
  }
  return indexPromise
}

/** Below this share of heard words matched, the result is a guess and is not used. */
const MIN_COVERAGE = 0.45

export interface MarkingResult {
  timeline: VerseTimelineEntry[]
  marking: AyahMarking
  recognition: Recognition
}

export interface MarkingOptions {
  /** 0–1 over the whole job: decoding and listening are most of it, matching the rest. */
  onProgress?: (fraction: number) => void
  signal?: { cancelled: boolean }
}

/** The ayat in `blob`, or null when nothing in it could be matched to the Quran with confidence. */
export async function markRecitationAyat(blob: Blob, options: MarkingOptions = {}): Promise<MarkingResult | null> {
  const { onProgress, signal } = options
  onProgress?.(0.02)
  const [samples, index] = await Promise.all([decodeRecording(blob), quranIndex()])
  onProgress?.(0.08)

  const saved = loadFeatureSettings()
  let recognition = await recognize(samples, {
    settings: saved,
    signal,
    onProgress: (fraction) => onProgress?.(0.08 + fraction * 0.9),
  })
  // A model that heard nothing was fed the wrong way: go back to the settings it is known to work with.
  if (recognition.words.length === 0 && JSON.stringify(saved) !== JSON.stringify(DEFAULT_FEATURE_SETTINGS)) {
    recognition = await recognize(samples, { settings: DEFAULT_FEATURE_SETTINGS, signal })
    if (recognition.words.length > 0) saveFeatureSettings(DEFAULT_FEATURE_SETTINGS)
  }
  if (signal?.cancelled) throw new Error('cancelled')

  const marking = markAyat(recognition.words, index, normalizeArabic)
  onProgress?.(1)
  if (marking.timeline.length === 0 || marking.coverage < MIN_COVERAGE) return null
  return { timeline: marking.timeline, marking, recognition }
}
