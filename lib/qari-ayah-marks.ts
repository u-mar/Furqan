'use client'

import { decodeRecording, recognize, type Recognition } from '@/lib/asr/offline-recognizer'
import { DEFAULT_FEATURE_SETTINGS, loadFeatureSettings, saveFeatureSettings } from '@/lib/asr/offline-features'
import { buildQuranWordIndex, markAyat, type AyahMarking, type QuranWordIndex } from '@/lib/asr/quran-match'
import { loadQuranData } from '@/lib/quran'
import { normalizeArabic } from '@/lib/search-ayahs'
import { spellForModel } from '@/lib/asr/ctc-align'
import { alignRecitation } from '@/lib/asr/align-recitation'
import { CTC_BLANK_ID, loadQuranTokenizer } from '@/lib/asr/tokenizer'
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
    keepEmissions: true,
    onProgress: (fraction) => onProgress?.(0.08 + fraction * 0.9),
  })
  // A model that heard nothing was fed the wrong way: go back to the settings it is known to work with.
  if (recognition.words.length === 0 && JSON.stringify(saved) !== JSON.stringify(DEFAULT_FEATURE_SETTINGS)) {
    recognition = await recognize(samples, { settings: DEFAULT_FEATURE_SETTINGS, signal, keepEmissions: true })
    if (recognition.words.length > 0) saveFeatureSettings(DEFAULT_FEATURE_SETTINGS)
  }
  if (signal?.cancelled) throw new Error('cancelled')

  const marking = markAyat(recognition.words, index, normalizeArabic)
  if (marking.timeline.length === 0 || marking.coverage < MIN_COVERAGE) return null
  const timeline = await alignTimeline(marking.timeline, recognition)
  // The scores take about 4 MB a minute; nothing needs them once the words are placed.
  delete recognition.emissions
  onProgress?.(1)
  return { timeline, marking, recognition }
}

/**
 * Exactly when each word of each marked ayah is said, and the ayat listening
 * missed: the ayat's own text is lined up with the recording
 * (lib/asr/align-recitation.ts), which gives every word a time, the ones the
 * model did not catch by ear included.
 */
async function alignTimeline(timeline: VerseTimelineEntry[], recognition: Recognition): Promise<VerseTimelineEntry[]> {
  const emissions = recognition.emissions
  if (!emissions?.length) return timeline
  const [data, tokenizer] = await Promise.all([loadQuranData(), loadQuranTokenizer()])
  const verses = new Map(data.verses.map((v) => [v.verse_key, v]))
  const order = [...verses.keys()].sort((a, b) => {
    const [ca, va] = a.split(':').map(Number)
    const [cb, vb] = b.split(':').map(Number)
    return ca - cb || va - vb
  })
  const spelt = new Map<string, number[][] | null>()
  const words = (verseKey: string): number[][] | null => {
    if (spelt.has(verseKey)) return spelt.get(verseKey) ?? null
    const verse = verses.get(verseKey)
    const texts = verse?.words?.length
      ? verse.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani)
      : (verse?.text_uthmani ?? '').split(/\s+/).filter(Boolean)
    const ids = texts.map((t) => spellForModel(t, tokenizer))
    const result = ids.length && ids.every((w) => w && w.length) ? (ids as number[][]) : null
    spelt.set(verseKey, result)
    return result
  }
  return alignRecitation(timeline, emissions, recognition.durationSec, { order, words }, CTC_BLANK_ID)
}

/**
 * The marking of one recording, owned here rather than by any screen: the
 * record screen shows how it is going, and if the recording is posted before
 * it is done, the upload waits for the same job instead of starting again or
 * losing it when the screen closes.
 */
export interface MarkingJob {
  blob: Blob
  promise: Promise<MarkingResult | null>
  progress: number
  listeners: Set<(fraction: number) => void>
  signal: { cancelled: boolean }
}

let currentJob: MarkingJob | null = null

/** Starts marking `blob`, or hands back the job already doing it. Another recording's job is stopped. */
export function startMarking(blob: Blob): MarkingJob {
  if (currentJob && currentJob.blob === blob && !currentJob.signal.cancelled) return currentJob
  cancelMarking()
  const job: MarkingJob = { blob, promise: Promise.resolve(null), progress: 0, listeners: new Set(), signal: { cancelled: false } }
  job.promise = markRecitationAyat(blob, {
    signal: job.signal,
    onProgress: (fraction) => {
      job.progress = fraction
      for (const listener of job.listeners) listener(fraction)
    },
  })
  // A job nobody is waiting on must not leave an unhandled rejection behind.
  job.promise.catch(() => {})
  currentJob = job
  return job
}

/** Stops the job in progress, if any (a new recording, or none wanted). */
export function cancelMarking(): void {
  if (currentJob) currentJob.signal.cancelled = true
  currentJob = null
}

/** The job marking `blob`, if there is one. */
export function markingJobFor(blob: Blob): MarkingJob | null {
  return currentJob && currentJob.blob === blob && !currentJob.signal.cancelled ? currentJob : null
}
