'use client'

import { pause as pauseListen } from '@/lib/listen-player'

/**
 * The adhan recording, and playing it.
 *
 * The file is not part of the code: it is a recording, so it is set by the
 * address in NEXT_PUBLIC_ADHAN_URL, or by placing an mp3 at public/audio/adhan.mp3.
 * Where there is none the adhan features simply stay out of sight.
 */
export const ADHAN_URL = process.env.NEXT_PUBLIC_ADHAN_URL || '/audio/adhan.mp3'

let element: HTMLAudioElement | null = null
let objectUrl: string | null = null
let checked: Promise<boolean> | null = null
let playing = false
const listeners = new Set<() => void>()

/**
 * The recording is kept on the phone the first time it is reached, so the adhan
 * sounds with no connection at all. (In the installed app it can also ship
 * inside the app as public/audio/adhan.mp3, and then there is nothing to fetch.)
 */
const ADHAN_CACHE = 'muyassar-adhan-v1'

function setPlaying(next: boolean) {
  if (playing === next) return
  playing = next
  listeners.forEach((l) => l())
}

export function subscribeAdhan(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isAdhanPlaying(): boolean {
  return playing
}

async function cachedResponse(): Promise<Response | undefined> {
  if (typeof caches === 'undefined') return undefined
  try {
    return await (await caches.open(ADHAN_CACHE)).match(ADHAN_URL)
  } catch {
    return undefined
  }
}

/**
 * Whether there is an adhan recording to play: one already on the phone, or
 * one that can be reached now. A yes is remembered; a no is asked again, since
 * it may only mean there was no connection.
 */
export function adhanAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (!checked) {
    checked = (async () => {
      if (await cachedResponse()) return true
      const ok = await fetch(ADHAN_URL, { method: 'HEAD', cache: 'no-store' })
        .then((res) => res.ok && (res.headers.get('content-type') ?? '').startsWith('audio'))
        .catch(() => false)
      if (!ok) checked = null
      return ok
    })()
  }
  return checked
}

/**
 * Keep the recording on the phone. Called whenever the app is online; does
 * nothing when it is already kept, and fails quietly when it cannot be reached.
 * A recording on another address needs that address to allow the app to read it
 * (a CORS rule); one served by the app itself always can.
 */
export async function keepAdhanOffline(): Promise<boolean> {
  if (typeof caches === 'undefined' || typeof window === 'undefined') return false
  try {
    const cache = await caches.open(ADHAN_CACHE)
    if (await cache.match(ADHAN_URL)) return true
    const res = await fetch(ADHAN_URL, { cache: 'no-store' })
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('audio')) return false
    await cache.put(ADHAN_URL, res)
    return true
  } catch {
    return false
  }
}

/** The address to play: the copy kept on the phone if there is one. */
async function playableUrl(): Promise<string> {
  const kept = await cachedResponse()
  if (kept) {
    try {
      const blob = await kept.blob()
      if (blob.size > 0) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = URL.createObjectURL(blob)
        return objectUrl
      }
    } catch {
      // Fall back to the network copy below.
    }
  }
  return ADHAN_URL
}

function audio(): HTMLAudioElement {
  if (!element) {
    element = new Audio()
    element.preload = 'auto'
    element.addEventListener('ended', () => setPlaying(false))
    element.addEventListener('pause', () => setPlaying(false))
    element.addEventListener('playing', () => setPlaying(true))
  }
  return element
}

/** Sound the adhan. A recitation that is playing gives way to it. */
export async function playAdhan(): Promise<void> {
  if (!(await adhanAvailable())) return
  try {
    pauseListen()
  } catch {
    // Nothing of Listen's was playing.
  }
  const el = audio()
  el.src = await playableUrl()
  el.currentTime = 0
  try {
    await el.play()
  } catch {
    // The browser refused to start sound without a tap; nothing else to do.
    setPlaying(false)
  }
}

export function stopAdhan(): void {
  if (!element) return
  element.pause()
  element.currentTime = 0
  setPlaying(false)
}
