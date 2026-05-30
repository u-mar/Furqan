'use client'

import { everyAyahAudioUrl, resolveReciterFolder } from '@/lib/reciters'

const AUDIO_CACHE = 'muyassar-audio-v1'

function surahKey(reciterFolder: string, surah: number): string {
  return `offline_audio_${reciterFolder}_${surah}`
}

export function isSurahAudioDownloaded(reciterFolder: string, surah: number): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(surahKey(reciterFolder, surah)) === '1'
}

function markSurahDownloaded(reciterFolder: string, surah: number): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(surahKey(reciterFolder, surah), '1')
}

export async function downloadSurahAudio(
  reciterFolder: string,
  surah: number,
  versesCount: number,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('Audio cache is not supported in this browser.')
  const cache = await caches.open(AUDIO_CACHE)

  const folder = resolveReciterFolder(reciterFolder)
  for (let ayah = 1; ayah <= versesCount; ayah++) {
    const url = everyAyahAudioUrl(folder, surah, ayah)
    const existing = await cache.match(url)
    if (!existing) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed downloading ayah ${ayah}`)
      await cache.put(url, res.clone())
    }
    onProgress?.(Math.round((ayah / versesCount) * 100))
  }

  markSurahDownloaded(reciterFolder, surah)
}

export async function isAyahAudioCached(
  reciterFolder: string,
  surah: number,
  ayah: number
): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  const folder = resolveReciterFolder(reciterFolder)
  const url = everyAyahAudioUrl(folder, surah, ayah)
  const cache = await caches.open(AUDIO_CACHE)
  const hit = await cache.match(url)
  return Boolean(hit)
}

export async function getPlayableAyahAudioUrl(
  reciterFolder: string,
  surah: number,
  ayah: number
): Promise<string | null> {
  const folder = resolveReciterFolder(reciterFolder)
  const onlineUrl = everyAyahAudioUrl(folder, surah, ayah)
  if (typeof caches === 'undefined') {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return null
    return onlineUrl
  }

  const cache = await caches.open(AUDIO_CACHE)
  const hit = await cache.match(onlineUrl)
  if (hit) {
    try {
      const blob = await hit.blob()
      if (blob.size > 0) return URL.createObjectURL(blob)
    } catch {
      /* fall through */
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  return onlineUrl
}

export const OFFLINE_AUDIO_HINT =
  'You are offline. Tap the download icon on a surah while on Wi‑Fi to listen without internet.'

export function revokePlayableAyahAudioUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}
