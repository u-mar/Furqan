'use client'

import { findVideoBackground, type VideoBackground } from '@/lib/qari-backgrounds'
import type { VerseTimelineEntry } from '@/lib/qari'
import { getReciterById, listenTimingSource } from '@/lib/reciters'

/**
 * Video mode in Listen's Now playing: the recitation over a slow nature clip, with the ayah
 * the reciter is on and its translation, the way Quran edits look. On or off for as long as
 * the app is open (a phone on mobile data should not start streaming video by itself).
 */

/** The scene behind every surah for now: the valley at sunset, from Mountain meadows. */
export const LISTEN_VIDEO_BACKGROUND: VideoBackground = findVideoBackground('motion-valley-sunset')

let on = false
const listeners = new Set<() => void>()

export function subscribeListenVideo(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isListenVideoOn(): boolean {
  return on
}

export function setListenVideo(next: boolean): void {
  if (on === next) return
  on = next
  listeners.forEach((listener) => listener())
}

const timelines = new Map<string, Promise<VerseTimelineEntry[] | null>>()

/**
 * How long after MP3Quran's start of an ayah the next one is shown, in seconds, for the recitations
 * measured against their sound (the silences between ayat found in the audio, Ar-Rahman and Al-Mulk):
 * for Sheikh Sufi the start sits right after the last ayah's sound ends, and the next sound begins
 * 0.4 to 0.5 seconds later (up to 0.75), so the ayah changed before it was said. A recitation not
 * measured keeps its times as they are.
 */
const SWITCH_DELAY_S: Record<string, number> = { soufi: 0.4 }

/**
 * When each ayah starts in the recording Listen plays for this reciter and surah, or null when
 * that recording has no timings (or they could not be had; asked again next time).
 */
export function listenTimeline(reciterId: string, surah: number): Promise<VerseTimelineEntry[] | null> {
  const source = listenTimingSource(getReciterById(reciterId))
  if (!source) return Promise.resolve(null)
  const key = `${source.source}:${source.id}:${surah}`
  let pending = timelines.get(key)
  if (!pending) {
    pending = fetch(`/api/ayah?type=chapter-audio&source=${source.source}&reciter=${source.id}&chapter=${surah}`)
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { ayat?: { key: string; from: number }[] }
        if (!data.ayat?.length) return null
        const delay = SWITCH_DELAY_S[reciterId] ?? 0
        return data.ayat.map((a) => ({ verseKey: a.key, atSeconds: a.from / 1000 + (a.key.endsWith(':1') ? 0 : delay) })).sort((a, b) => a.atSeconds - b.atSeconds)
      })
      .catch(() => null)
    timelines.set(key, pending)
    void pending.then((result) => {
      if (!result) timelines.delete(key)
    })
  }
  return pending
}
