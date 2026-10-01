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
import { countPlay, getCachedRecitationAudio, recitationAudioUrl, type Recitation } from '@/lib/qari'
import { tr } from '@/lib/i18n-core'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused'

export interface PlayerSnapshot {
  current: Recitation | null
  status: PlayerStatus
  /** Seconds into the current recitation. */
  position: number
  duration: number
  /** Playback speed, 1 being normal. Kept between recitations. */
  rate: number
}

export const PLAYBACK_RATES = [0.75, 1, 1.25] as const

const IDLE: PlayerSnapshot = { current: null, status: 'idle', position: 0, duration: 0, rate: 1 }

let snapshot: PlayerSnapshot = IDLE
const listeners = new Set<() => void>()
const errorListeners = new Set<(message: string) => void>()

let audio: HTMLAudioElement | null = null
let context: AudioContext | null = null
let mixer: SpaceMixer | null = null
let queue: Recitation[] = []
let viewerId: string | null = null
let rate = 1
/** Every recitation passes through this one gain, so a switch can fade rather than cut (a cut clicks). */
let master: GainNode | null = null
let pauseTimer: number | null = null
/** The object URL the element is playing from, when it is playing a downloaded copy. */
let objectUrl: string | null = null
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
  el.defaultPlaybackRate = rate
  el.playbackRate = rate
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
      master = context.createGain()
      mixer.output.connect(master)
      master.connect(context.destination)
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
  // Ayah cards are pictures: nothing to play, and not stops in a queue.
  if (r.kind === 'ayah') return
  const el = ensureAudio()
  if (options.queue) queue = options.queue.filter((q) => q.kind !== 'ayah')
  if (options.viewerId !== undefined) viewerId = options.viewerId

  const switching = snapshot.current?.id !== r.id
  if (switching) {
    // A copy already on the phone starts at once and can be sought anywhere; otherwise stream it.
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = null
    const cached = getCachedRecitationAudio(r.id)
    if (cached) objectUrl = URL.createObjectURL(cached)
    el.src = objectUrl ?? recitationAudioUrl(r.id)
    // A new source can reset the speed to the default; the default is kept in step with it.
    el.playbackRate = rate
    emit({ current: r, status: 'loading', position: 0, duration: r.durationSec })
  } else {
    emit({ status: 'loading' })
  }
  describeToLockScreen(r)

  // Cancel a fade-out that was about to pause this, and let the voice in gently.
  if (pauseTimer !== null) {
    window.clearTimeout(pauseTimer)
    pauseTimer = null
  }
  fadeMaster(1, 0.035, switching || el.paused ? 0 : undefined)

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

/**
 * Ease `master` to `target`. `from` first drops it to that level, so a voice can start from silence.
 * Without the graph yet (the very first play) there is nothing to ease, and it starts as it is.
 */
function fadeMaster(target: number, timeConstant: number, from?: number) {
  if (!master || !context) return
  const now = context.currentTime
  master.gain.cancelScheduledValues(now)
  if (from !== undefined) master.gain.setValueAtTime(from, now)
  master.gain.setTargetAtTime(target, now, timeConstant)
}

export function pausePlayback(): void {
  const el = audio
  if (!el || el.paused) return
  if (!master || !context) {
    el.pause()
    return
  }
  // Fade out over a few milliseconds, then pause: stopping a voice mid-wave is a click.
  fadeMaster(0, 0.02)
  if (pauseTimer !== null) window.clearTimeout(pauseTimer)
  pauseTimer = window.setTimeout(() => {
    pauseTimer = null
    el.pause()
  }, 90)
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

/** Faster or slower, without changing the pitch. Stays for the recitations after this one. */
export function setPlaybackRate(next: number): void {
  rate = next
  if (audio) {
    audio.defaultPlaybackRate = next
    audio.playbackRate = next
  }
  emit({ rate: next })
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
  if (pauseTimer !== null) window.clearTimeout(pauseTimer)
  pauseTimer = null
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }
  fadeMaster(1, 0.01)
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = null
  queue = []
  emit({ ...IDLE, rate })
}
