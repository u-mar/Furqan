'use client'

import { downloadSurahAudio, isSurahAudioDownloaded } from '@/lib/offline-audio'

/**
 * Surahs being saved for offline listening, one after another.
 *
 * Tap several download buttons and they wait their turn instead of competing
 * for the connection. Each row reads only its own entry, so a progress tick
 * redraws one ring, not the whole list.
 */

export type DownloadState = 'none' | 'queued' | 'saving' | 'done'

export interface SurahDownload {
  state: DownloadState
  percent: number
}

export interface DownloadResult {
  reciterId: string
  surahId: number
  name: string
  ok: boolean
}

export const NOT_DOWNLOADED: SurahDownload = { state: 'none', percent: 0 }
const DOWNLOADED: SurahDownload = { state: 'done', percent: 100 }
const QUEUED: SurahDownload = { state: 'queued', percent: 0 }

const active = new Map<string, SurahDownload>()
const saved = new Map<string, boolean>()
const queue: Array<Omit<DownloadResult, 'ok'>> = []
const listeners = new Set<() => void>()
const finishedListeners = new Set<(result: DownloadResult) => void>()
let running = false
let version = 0

function key(reciterId: string, surahId: number): string {
  return `${reciterId}:${surahId}`
}

function emit(finished = false) {
  if (finished) version++
  listeners.forEach((listener) => listener())
}

export function subscribeDownloads(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Changes when a download ends — for counts across the list, not every progress tick. */
export function getDownloadsVersion(): number {
  return version
}

export function surahDownload(reciterId: string, surahId: number): SurahDownload {
  const k = key(reciterId, surahId)
  const entry = active.get(k)
  if (entry) return entry
  let done = saved.get(k)
  if (done === undefined) {
    done = isSurahAudioDownloaded(reciterId, surahId)
    saved.set(k, done)
  }
  return done ? DOWNLOADED : NOT_DOWNLOADED
}

export function onDownloadFinished(listener: (result: DownloadResult) => void): () => void {
  finishedListeners.add(listener)
  return () => finishedListeners.delete(listener)
}

export function queueDownload(reciterId: string, surah: { id: number; englishName: string }): void {
  if (surahDownload(reciterId, surah.id).state !== 'none') return
  active.set(key(reciterId, surah.id), QUEUED)
  queue.push({ reciterId, surahId: surah.id, name: surah.englishName })
  emit()
  void work()
}

async function work() {
  if (running) return
  running = true
  while (queue.length) {
    const job = queue.shift()!
    const k = key(job.reciterId, job.surahId)
    active.set(k, { state: 'saving', percent: 0 })
    emit()
    let ok = true
    try {
      await downloadSurahAudio(job.reciterId, job.surahId, (percent) => {
        if (active.get(k)?.percent === percent) return
        active.set(k, { state: 'saving', percent })
        emit()
      })
      saved.set(k, true)
    } catch {
      ok = false
    }
    active.delete(k)
    emit(true)
    finishedListeners.forEach((listener) => listener({ ...job, ok }))
  }
  running = false
}
