/**
 * The one player behind every Qari screen.
 *
 * A single audio element for the whole app: starting a recitation anywhere
 * stops whatever was playing, the playing row stays lit as you move between
 * the feed and a profile, and "Play all" simply walks a queue.
 *
 * Recordings are stored dry. The room each was published with is put back by
 * one space mixer, re-tuned per track, which is cheaper than a graph per row
 * and keeps the reverb identical to what the reciter heard when publishing.
 */

import { APP_NAME } from '@/lib/app-brand'
import { createSpaceMixer, findSpace, type SpaceId, type SpaceMixer } from '@/lib/audio-space'
import { countPlay, recitationAudioUrl, type Recitation } from '@/lib/qari'
import { tr } from '@/lib/i18n-core'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused'

export interface PlayerSnapshot {
  current: Recitation | null
  status: PlayerStatus
  /** Seconds into the current recitation. */
  position: number
  duration: number
}

const IDLE: PlayerSnapshot = { current: null, status: 'idle', position: 0, duration: 0 }

let snapshot: PlayerSnapshot = IDLE
const listeners = new Set<() => void>()
const errorListeners = new Set<(message: string) => void>()

let audio: HTMLAudioElement | null = null
let context: AudioContext | null = null
let mixer: SpaceMixer | null = null
let queue: Recitation[] = []
let viewerId: string | null = null
/** Plays are counted once per recitation per visit, not per tap. */
const counted = new Set<string>()

function emit(patch: Partial<PlayerSnapshot>) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((listener) => listener())
}

export function subscribePlayer(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPlayerSnapshot(): PlayerSnapshot {
  return snapshot
}

export function getServerPlayerSnapshot(): PlayerSnapshot {
  return IDLE
}

/** Told when something could not be played, so a screen can say so. */
export function onPlayerError(listener: (message: string) => void): () => void {
  errorListeners.add(listener)
  return () => errorListeners.delete(listener)
}

function fail(message: string) {
  emit({ status: snapshot.current ? 'paused' : 'idle' })
  errorListeners.forEach((listener) => listener(message))
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio
  const el = new Audio()
  el.preload = 'auto'
  // Needed for the space mixer to read the samples.
  el.crossOrigin = 'anonymous'
  el.addEventListener('playing', () => emit({ status: 'playing' }))
  el.addEventListener('waiting', () => emit({ status: 'loading' }))
  el.addEventListener('pause', () => {
    if (snapshot.current && !el.ended) emit({ status: 'paused' })
  })
  el.addEventListener('timeupdate', () => {
    emit({
      position: el.currentTime,
      duration: finite(el.duration) || snapshot.current?.durationSec || 0,
    })
  })
  el.addEventListener('ended', () => {
    if (!playNext()) emit({ status: 'paused', position: 0 })
  })
  el.addEventListener('error', () => {
    if (el.src) fail(tr('That recitation could not be played.'))
  })
  audio = el
  return el
}

/**
 * Route through the mixer only once playback is running: feeding a media
 * element into a suspended context silences it for good. A recitation playing
 * dry is a far smaller failure than one not playing at all.
 */
async function applySpace(r: Recitation) {
  const el = audio
  if (!el) return
  const space = findSpace(r.space as SpaceId)
  try {
    if (!context) context = new AudioContext()
    if (context.state !== 'running') await context.resume()
    if (context.state !== 'running') return
    if (!mixer) {
      mixer = createSpaceMixer(context, context.createMediaElementSource(el))
      mixer.output.connect(context.destination)
    }
    mixer.setSpace(space)
  } catch {
    // Left dry, still audible.
  }
}

function describeToLockScreen(r: Recitation) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: r.title,
      artist: r.userName,
      album: APP_NAME,
      artwork: [
        {
          src: `/api/qari/avatar/${encodeURIComponent(r.userUsername.toLowerCase())}`,
          sizes: '512x512',
          type: 'image/jpeg',
        },
        { src: '/icons/icon-512', sizes: '512x512', type: 'image/png' },
      ],
    })
    navigator.mediaSession.setActionHandler('play', () => resumePlayback())
    navigator.mediaSession.setActionHandler('pause', () => pausePlayback())
    navigator.mediaSession.setActionHandler('nexttrack', queue.length > 1 ? () => void playNext() : null)
  } catch {
    // Lock-screen controls are a nicety.
  }
}

export function playRecitation(
  r: Recitation,
  options: { queue?: Recitation[]; viewerId?: string | null } = {}
): void {
  const el = ensureAudio()
  if (options.queue) queue = options.queue
  if (options.viewerId !== undefined) viewerId = options.viewerId

  if (snapshot.current?.id !== r.id) {
    el.src = recitationAudioUrl(r.id)
    emit({ current: r, status: 'loading', position: 0, duration: r.durationSec })
  } else {
    emit({ status: 'loading' })
  }
  describeToLockScreen(r)

  void el
    .play()
    .then(() => {
      void applySpace(r)
      if (!counted.has(r.id)) {
        counted.add(r.id)
        void countPlay(r.id, viewerId)
      }
    })
    .catch((err: unknown) => {
      // A newer play() superseding this one is not a failure.
      if (err instanceof DOMException && err.name === 'AbortError') return
      fail(tr('That recitation could not be played.'))
    })
}

/** Play or pause this recitation, whichever makes sense right now. */
export function togglePlayback(
  r: Recitation,
  options: { queue?: Recitation[]; viewerId?: string | null } = {}
): void {
  if (snapshot.current?.id === r.id && (snapshot.status === 'playing' || snapshot.status === 'loading')) {
    pausePlayback()
    return
  }
  playRecitation(r, options)
}

export function pausePlayback(): void {
  audio?.pause()
}

export function resumePlayback(): void {
  if (snapshot.current) playRecitation(snapshot.current)
}

export function seekPlayback(fraction: number): void {
  const el = audio
  if (!el || !snapshot.current) return
  const total = finite(el.duration) || snapshot.current.durationSec
  if (total <= 0) return
  el.currentTime = Math.max(0, Math.min(total - 0.05, fraction * total))
  emit({ position: el.currentTime })
}

function nextInQueue(): Recitation | undefined {
  const index = snapshot.current ? queue.findIndex((q) => q.id === snapshot.current!.id) : -1
  return index >= 0 ? queue[index + 1] : undefined
}

function playNext(): boolean {
  const next = nextInQueue()
  if (!next) return false
  playRecitation(next)
  return true
}

/** Whether something waits after the recitation playing — for a "next" button. */
export function hasNextRecitation(): boolean {
  return Boolean(nextInQueue())
}

/** Skip to the next recitation in the list it was played from. */
export function skipToNextRecitation(): boolean {
  return playNext()
}

/** Silence Qari entirely, for when you leave it or start recording. */
export function stopPlayback(): void {
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  queue = []
  emit(IDLE)
}
