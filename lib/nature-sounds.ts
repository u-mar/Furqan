'use client'

import { APP_NAME } from '@/lib/app-brand'
import { tr } from '@/lib/i18n-core'

/**
 * Nature mode: rain, waves, birds and the like, played on their own or
 * under a recitation, and kept outside React like the Listen player.
 *
 * The recordings are CC0 field recordings (BigSoundBank), cut into loops of
 * two or three minutes whose first and last FADE_S seconds are baked
 * equal-power fades. Each sound has two audio elements: as one nears its end
 * the other starts from the top, and the overlapping fades add up to a steady
 * level — no gap where an <audio loop> would stutter, and no volume ramps to
 * run, so it holds up with the phone locked. Uploaded with
 * scripts/upload-nature-sounds.mjs.
 */

export type NatureId = 'rain' | 'thunderstorm' | 'roof' | 'waves' | 'birds' | 'stream' | 'forest' | 'wind' | 'night' | 'fire'

export interface NatureSound {
  id: NatureId
  name: string
}

export const NATURE_SOUNDS: readonly NatureSound[] = [
  { id: 'rain', name: 'Rain' },
  { id: 'thunderstorm', name: 'Storm' },
  { id: 'roof', name: 'Rain on roof' },
  { id: 'waves', name: 'Waves' },
  { id: 'birds', name: 'Birds' },
  { id: 'stream', name: 'Stream' },
  { id: 'forest', name: 'Forest' },
  { id: 'wind', name: 'Wind' },
  { id: 'night', name: 'Night' },
  { id: 'fire', name: 'Fireplace' },
]

/** R2, through the bucket's own domain; a changed loop goes up under a new version. */
const BASE = 'https://audio.qurannaba.com/nature/v1/'
/** The baked fade at each end of a loop, in seconds. */
const FADE_S = 6
/** More than this at once is only noise; a fourth replaces the oldest. */
const MAX_AT_ONCE = 3
const DEFAULT_VOLUME = 0.6
const KEY = 'naba_nature'

export interface NatureState {
  /** The sounds chosen, oldest first; they keep their place while paused. */
  sounds: NatureId[]
  playing: boolean
  /** Started and not stopped since — playing or paused — so its player shows. */
  live: boolean
  volume: number
}

interface Loop {
  els: [HTMLAudioElement, HTMLAudioElement]
  /** The element carrying the sound now (the other is idle or fading out). */
  lead: 0 | 1
}

const loops = new Map<NatureId, Loop>()
const listeners = new Set<() => void>()
const tickListeners = new Set<() => void>()
/** Set by the sleep timer as it fades everything out; 1 otherwise. */
let fade = 1
let state: NatureState = { sounds: [], playing: false, live: false, volume: DEFAULT_VOLUME }
let loaded = false
const SERVER_STATE: NatureState = { sounds: [], playing: false, live: false, volume: DEFAULT_VOLUME }

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<NatureState>
    const sounds = (saved.sounds ?? []).filter((id) => NATURE_SOUNDS.some((s) => s.id === id)).slice(-MAX_AT_ONCE)
    const volume = typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1 ? saved.volume : DEFAULT_VOLUME
    state = { sounds, playing: false, live: false, volume }
  } catch {
    // Nothing remembered.
  }
}

function setState(patch: Partial<NatureState>) {
  state = { ...state, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify({ sounds: state.sounds, volume: state.volume }))
  } catch {
    // Only a memory of the last mix.
  }
  listeners.forEach((listener) => listener())
}

export function subscribeNature(listener: () => void): () => void {
  load()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getNatureState(): NatureState {
  load()
  return state
}

export function getServerNatureState(): NatureState {
  return SERVER_STATE
}

export function natureName(id: NatureId): string {
  return tr(NATURE_SOUNDS.find((s) => s.id === id)?.name ?? '')
}

export function isNaturePlaying(): boolean {
  return state.playing && state.sounds.length > 0
}

/** Called as the sounds play, even with the phone locked — the sleep timer checks itself on it. */
export function onNatureTick(listener: () => void): () => void {
  tickListeners.add(listener)
  return () => tickListeners.delete(listener)
}

function level(): number {
  return Math.max(0, Math.min(1, state.volume * fade))
}

function setVolume(el: HTMLAudioElement) {
  try {
    el.volume = level()
  } catch {
    // Read-only here (iPhone): the phone's own buttons set it.
  }
}

function start(el: HTMLAudioElement) {
  el.currentTime = 0
  setVolume(el)
  el.play().catch(() => {
    // Blocked or offline; the next tap tries again.
  })
}

function makeLoop(id: NatureId): Loop {
  const make = (): HTMLAudioElement => {
    const el = new Audio()
    el.preload = 'auto'
    el.src = `${BASE}${id}.mp3`
    return el
  }
  const loop: Loop = { els: [make(), make()], lead: 0 }
  loop.els.forEach((el, i) => {
    el.addEventListener('timeupdate', () => {
      tickListeners.forEach((listener) => listener())
      if (i !== loop.lead || !state.playing) return
      const duration = Number.isFinite(el.duration) ? el.duration : 0
      // Nearly at the end: the other copy starts, fading in as this one fades out.
      if (duration && el.currentTime >= duration - FADE_S) {
        loop.lead = i === 0 ? 1 : 0
        start(loop.els[loop.lead])
      }
    })
    // Missed the moment (a slow phone): carry straight on.
    el.addEventListener('ended', () => {
      if (i === loop.lead && state.playing) {
        loop.lead = i === 0 ? 1 : 0
        start(loop.els[loop.lead])
      }
    })
  })
  return loop
}

function dropLoop(id: NatureId) {
  const loop = loops.get(id)
  if (!loop) return
  for (const el of loop.els) {
    el.pause()
    el.removeAttribute('src')
    el.load()
  }
  loops.delete(id)
}

function playLoop(id: NatureId) {
  let loop = loops.get(id)
  if (!loop) {
    loop = makeLoop(id)
    loops.set(id, loop)
    start(loop.els[0])
    return
  }
  // Resume where it was: the copy carrying it, and the other too if it paused mid-overlap.
  loop.els.forEach((el, i) => {
    if (i !== loop.lead && (el.currentTime === 0 || el.ended)) return
    setVolume(el)
    el.play().catch(() => {})
  })
}

function pauseLoop(id: NatureId) {
  loops.get(id)?.els.forEach((el) => el.pause())
}

/** Tap a sound: on (playing everything chosen) or off. */
export function toggleNatureSound(id: NatureId): void {
  load()
  if (state.sounds.includes(id)) {
    dropLoop(id)
    const sounds = state.sounds.filter((s) => s !== id)
    setState({ sounds, playing: state.playing && sounds.length > 0, live: state.live && sounds.length > 0 })
    if (!sounds.length) releaseLockScreen()
    return
  }
  let sounds = [...state.sounds, id]
  while (sounds.length > MAX_AT_ONCE) {
    dropLoop(sounds[0])
    sounds = sounds.slice(1)
  }
  setState({ sounds, playing: true, live: true })
  sounds.forEach(playLoop)
  claimLockScreen()
}

export function playNature(): void {
  load()
  if (!state.sounds.length) return
  fade = 1
  setState({ playing: true, live: true })
  state.sounds.forEach(playLoop)
  claimLockScreen()
}

export function pauseNature(): void {
  if (!state.playing) return
  state.sounds.forEach(pauseLoop)
  setState({ playing: false })
  if (ownsLockScreen) reportPlayback('paused')
}

export function toggleNature(): void {
  if (state.playing) pauseNature()
  else playNature()
}

/** Everything off and unloaded; the mix is remembered for next time. */
export function stopNature(): void {
  for (const id of [...loops.keys()]) dropLoop(id)
  fade = 1
  if (state.playing || state.live) setState({ playing: false, live: false })
  releaseLockScreen()
}

export function setNatureVolume(volume: number): void {
  setState({ volume: Math.max(0, Math.min(1, volume)) })
  loops.forEach((loop) => loop.els.forEach(setVolume))
}

/** The sleep timer's fade-out: 1 is full, 0 silent. */
export function setNatureFade(value: number): void {
  const next = Math.max(0, Math.min(1, value))
  if (next === fade) return
  fade = next
  loops.forEach((loop) => loop.els.forEach(setVolume))
}

/* ----------------------------------------------------------- lock screen */

/** Whether the lock screen shows Nature mode (a recitation takes it over when one plays). */
let ownsLockScreen = false

function hasMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
}

function reportPlayback(value: MediaSessionPlaybackState) {
  try {
    navigator.mediaSession.playbackState = value
  } catch {
    // Not offered here.
  }
}

/**
 * Show the sounds on the lock screen, unless a recitation is there already.
 * Listen calls this when its recitation stops, so the controls come back here.
 */
export function claimLockScreen(): void {
  if (!hasMediaSession() || !state.sounds.length) return
  if (navigator.mediaSession.metadata && !ownsLockScreen) return
  ownsLockScreen = true
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.sounds.map(natureName).join(' · '),
      artist: tr('Nature mode'),
      album: APP_NAME,
      artwork: [{ src: '/icons/icon-512', sizes: '512x512', type: 'image/png' }],
    })
  } catch {
    // Lock-screen details are a nicety.
  }
  const handlers: Array<[MediaSessionAction, MediaSessionActionHandler | null]> = [
    ['play', () => playNature()],
    ['pause', () => pauseNature()],
    ['stop', () => stopNature()],
    ['seekbackward', null],
    ['seekforward', null],
    ['seekto', null],
    ['previoustrack', null],
    ['nexttrack', null],
  ]
  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {
      // Not offered here.
    }
  }
  reportPlayback(state.playing ? 'playing' : 'paused')
}

/** A recitation has put itself on the lock screen. */
export function yieldLockScreen(): void {
  ownsLockScreen = false
}

function releaseLockScreen() {
  if (!ownsLockScreen || !hasMediaSession()) return
  ownsLockScreen = false
  try {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
  } catch {
    // Nothing was shown.
  }
  for (const action of ['play', 'pause', 'stop'] as MediaSessionAction[]) {
    try {
      navigator.mediaSession.setActionHandler(action, null)
    } catch {
      // Not offered here.
    }
  }
}
