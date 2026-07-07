'use client'

import {
  ayahAudioUrl,
  getReciterById,
  isSurahOnlyReciter,
  listenSurahAudioUrl,
  surahAudioUrl,
} from '@/lib/reciters'

const AUDIO_CACHE = 'muyassar-audio-v1'

function surahKey(reciterId: string, surah: number): string {
  return `offline_audio_${reciterId}_${surah}`
}

export function isSurahAudioDownloaded(reciterId: string, surah: number): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(surahKey(reciterId, surah)) === '1'
}

function markSurahDownloaded(reciterId: string, surah: number): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(surahKey(reciterId, surah), '1')
}

export async function downloadSurahAudio(
  reciterId: string,
  surah: number,
  versesCount: number,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Audio cache is not supported in this browser.')
  const cache = await caches.open(AUDIO_CACHE)
  const reciter = getReciterById(reciterId)
  const url = listenSurahAudioUrl(reciter, surah)
  const existing = await cache.match(url)
  if (!existing) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed downloading surah ${surah}`)
    await cache.put(url, res.clone())
  }
  onProgress?.(100)
  markSurahDownloaded(reciterId, surah)
}

export async function isAyahAudioCached(
  reciterId: string,
  surah: number,
  ayah: number
): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const reciter = getReciterById(reciterId)
  const url = isSurahOnlyReciter(reciter) ? surahAudioUrl(reciter, surah) : ayahAudioUrl(reciter, surah, ayah)
  const cache = await caches.open(AUDIO_CACHE)
  const hit = await cache.match(url)
  return Boolean(hit)
}

async function playableFromCache(onlineUrl: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null
  const cache = await caches.open(AUDIO_CACHE)
  const hit = await cache.match(onlineUrl)
  if (!hit) return null
  try {
    const blob = await hit.blob()
    if (blob.size > 0) return URL.createObjectURL(blob)
  } catch {
    return null
  }
  return null
}

export async function getPlayableListenSurahAudioUrl(
  reciterId: string,
  surah: number
): Promise<string | null> {
  const reciter = getReciterById(reciterId)
  const onlineUrl = listenSurahAudioUrl(reciter, surah)

  const cached = await playableFromCache(onlineUrl)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  return onlineUrl
}

export async function getPlayableSurahAudioUrl(
  reciterId: string,
  surah: number
): Promise<string | null> {
  const reciter = getReciterById(reciterId)
  const onlineUrl = surahAudioUrl(reciter, surah)

  const cached = await playableFromCache(onlineUrl)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  return onlineUrl
}

export async function getPlayableAyahAudioUrl(
  reciterId: string,
  surah: number,
  ayah: number
): Promise<string | null> {
  const reciter = getReciterById(reciterId)
  if (isSurahOnlyReciter(reciter)) {
    return getPlayableSurahAudioUrl(reciterId, surah)
  }

  const onlineUrl = ayahAudioUrl(reciter, surah, ayah)
  const cached = await playableFromCache(onlineUrl)
  if (cached) return cached

  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  return onlineUrl
}

export const OFFLINE_AUDIO_HINT =
  'You are offline. Tap the download icon on a surah while on Wi‑Fi to listen without internet.'

export function revokePlayableAyahAudioUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
