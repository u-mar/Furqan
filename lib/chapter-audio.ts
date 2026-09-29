import { getReciterById, surahAudioUrl, timedSurahSource } from '@/lib/reciters'

/** One ayah's place inside a whole-surah recording, in milliseconds. */
export interface TimedAyah {
  key: string
  from: number
  to: number
}

export interface ChapterAudio {
  /** The whole surah as one recording. */
  url: string
  ayat: TimedAyah[]
  /** verse key → its place, for lookups. */
  byKey: Map<string, TimedAyah>
}

const cache = new Map<string, Promise<ChapterAudio | null>>()

/** Whether this reciter's whole-surah recording has ayah timings (so it can play gaplessly). */
export function hasTimedAudio(reciterId: string): boolean {
  return timedSurahSource(getReciterById(reciterId)) !== null
}

/**
 * A surah as one recording plus where each ayah starts and ends in it. Null when
 * this reciter has no timings, the request fails, or the phone is offline — the
 * caller then plays ayah by ayah as before.
 */
export function getChapterAudio(reciterId: string, chapter: number): Promise<ChapterAudio | null> {
  const reciter = getReciterById(reciterId)
  const timing = timedSurahSource(reciter)
  if (!timing) return Promise.resolve(null)
  if (typeof navigator !== 'undefined' && !navigator.onLine) return Promise.resolve(null)

  const key = `${timing.source}:${timing.id}:${chapter}`
  let pending = cache.get(key)
  if (!pending) {
    pending = fetch(`/api/ayah?type=chapter-audio&source=${timing.source}&reciter=${timing.id}&chapter=${chapter}`)
      .then(async (res): Promise<ChapterAudio | null> => {
        if (!res.ok) return null
        const data = (await res.json()) as { url?: string; ayat?: TimedAyah[] }
        // Quran.com sends the recording's address with its timings; for MP3Quran it is the reciter's own file.
        const url = timing.source === 'mp3quran' ? surahAudioUrl(reciter, chapter) : data.url
        if (!url || !data.ayat?.length) return null
        return { url, ayat: data.ayat, byKey: new Map(data.ayat.map((a) => [a.key, a])) }
      })
      .catch(() => null)
    cache.set(key, pending)
    // A failure must not stick: try again next time.
    void pending.then((result) => {
      if (!result) cache.delete(key)
    })
  }
  return pending
}
