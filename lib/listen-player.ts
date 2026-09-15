'use client'

import { APP_NAME } from '@/lib/app-brand'
import { clearListenObjectUrl, getListenAudio, peekListenAudio, setListenObjectUrl } from '@/lib/listen-audio'
import { getPlayableListenSurahAudioUrl, isSurahAudioDownloaded } from '@/lib/offline-audio'
import { getChapters } from '@/lib/quran'
import { getReciterById } from '@/lib/reciters'
import type { Chapter } from '@/types'

/**
 * What Listen is playing, kept outside React.
 *
 * The audio element already outlives the screen (see listen-audio); the state
 * around it does too, so the sleep timer and "play the next surah" keep
 * working on another screen or with the phone locked, and Listen shows the
 * truth whenever it opens.
 */

export type ListenStatus = 'idle' | 'loading' | 'playing' | 'paused'
export type SleepChoice = 15 | 30 | 45 | 60 | 'surah'

export const SLEEP_CHOICES: SleepChoice[] = [15, 30, 45, 60, 'surah']

export interface ListenSleep {
  choice: SleepChoice
  /** When the time is up; null when it stops at the end of the surah instead. */
  endsAt: number | null
}

export interface ListenState {
  surah: Chapter | null
  reciterId: string | null
  status: ListenStatus
  error: string | null
  sleep: ListenSleep | null
}

export interface ListenProgress {
  /** Seconds into the surah. */
  position: number
  duration: number
}

const IDLE: ListenState = { surah: null, reciterId: null, status: 'idle', error: null, sleep: null }
const NO_PROGRESS: ListenProgress = { position: 0, duration: 0 }

export const SKIP_SECONDS = 15
/** Once the sleep time is up the recitation fades out over this long, then stops. */
const FADE_MS = 8000
const SLEEP_CHOICE_KEY = 'muyassar_sleep_choice'
const PLAY_FAILED = 'This surah could not be played.'
const OFFLINE_NOT_SAVED = 'You are offline, and this surah is not downloaded.'

let state: ListenState = IDLE
let progress: ListenProgress = NO_PROGRESS
const stateListeners = new Set<() => void>()
const progressListeners = new Set<() => void>()

/** Bumped by every new play or stop, so a slow load cannot overwrite a newer one. */
let session = 0
/** True while a new source is loading, when the element's own pause is expected. */
let switching = false
let wired = false
let sleepTicker: number | null = null
let volumeCanChange: boolean | null = null

function setState(patch: Partial<ListenState>) {
  state = { ...state, ...patch }
  stateListeners.forEach((listener) => listener())
}

function setProgress(next: ListenProgress) {
  if (next.position === progress.position && next.duration === progress.duration) return
  progress = next
  progressListeners.forEach((listener) => listener())
}

export function subscribeListen(listener: () => void): () => void {
  stateListeners.add(listener)
  return () => stateListeners.delete(listener)
}

export function getListenState(): ListenState {
  return state
}

export function getServerListenState(): ListenState {
  return IDLE
}

/** Position changes several times a second; only what shows it should listen. */
export function subscribeListenProgress(listener: () => void): () => void {
  progressListeners.add(listener)
  return () => progressListeners.delete(listener)
}

export function getListenProgress(): ListenProgress {
  return progress
}

export function getServerListenProgress(): ListenProgress {
  return NO_PROGRESS
}

function finite(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function element(): HTMLAudioElement {
  const el = getListenAudio()
  if (wired) return el
  wired = true

  el.addEventListener('playing', () => {
    if (!state.surah || switching) return
    setState({ status: 'playing', error: null })
    reportPlayback('playing')
    reportPosition()
  })
  el.addEventListener('waiting', () => {
    if (state.surah && state.status === 'playing') setState({ status: 'loading' })
  })
  el.addEventListener('pause', () => {
    if (!state.surah || switching || el.ended) return
    setState({ status: 'paused' })
    reportPlayback('paused')
    reportPosition()
  })
  el.addEventListener('timeupdate', () => {
    if (!state.surah || switching) return
    setProgress({ position: el.currentTime, duration: finite(el.duration) || progress.duration })
    checkSleep()
  })
  el.addEventListener('durationchange', () => {
    if (!state.surah) return
    setProgress({ position: el.currentTime, duration: finite(el.duration) })
    reportPosition()
  })
  el.addEventListener('seeked', reportPosition)
  el.addEventListener('ended', () => void onEnded())
  el.addEventListener('error', () => {
    if (!state.surah || switching || !el.getAttribute('src')) return
    setState({ status: 'paused', error: PLAY_FAILED })
  })
  return el
}

function unload(el: HTMLAudioElement) {
  el.pause()
  el.removeAttribute('src')
  el.load()
  clearListenObjectUrl()
}

/** Start a surah, optionally from a point in it (switching narration keeps your place). */
export async function playSurah(surah: Chapter, reciterId: string, resumeAt = 0): Promise<void> {
  const el = element()
  const mine = ++session
  switching = true
  setState({ surah, reciterId, status: 'loading', error: null })
  setProgress({ position: resumeAt, duration: 0 })
  describe(surah, reciterId)

  const url = await getPlayableListenSurahAudioUrl(reciterId, surah.id)
  if (mine !== session) return
  if (!url) {
    switching = false
    unload(el)
    setState({ status: 'paused', error: OFFLINE_NOT_SAVED })
    return
  }

  try {
    el.pause()
    clearListenObjectUrl()
    if (url.startsWith('blob:')) setListenObjectUrl(url)
    el.src = url
    restoreVolume(el)
    if (resumeAt > 0) el.currentTime = resumeAt
    await el.play()
    if (mine !== session) return
    if (resumeAt > 0 && Math.abs(el.currentTime - resumeAt) > 2) el.currentTime = resumeAt
    switching = false
    setState({ status: 'playing', error: null })
    reportPlayback('playing')
  } catch (err) {
    if (mine !== session) return
    switching = false
    if (isAbort(err)) {
      if (el.paused) setState({ status: 'paused' })
      return
    }
    setState({ status: 'paused', error: PLAY_FAILED })
  }
}

export function pause(): void {
  peekListenAudio()?.pause()
}

export function resume(): void {
  const el = peekListenAudio()
  const { surah, reciterId } = state
  if (!el || !surah || !reciterId) return
  // Nothing loaded (it failed, or the narration changed while paused): load it again where it was.
  if (!el.getAttribute('src')) {
    void playSurah(surah, reciterId, progress.position < progress.duration - 1 ? progress.position : 0)
    return
  }
  restoreVolume(el)
  if (state.error) setState({ error: null })
  el.play().catch((err: unknown) => {
    if (isAbort(err)) return
    setState({ status: 'paused', error: PLAY_FAILED })
  })
}

export function togglePlay(): void {
  if (!state.surah) return
  if (state.status === 'playing' || state.status === 'loading') pause()
  else resume()
}

export function seekTo(seconds: number): void {
  const el = peekListenAudio()
  if (!el || !state.surah) return
  // Unloaded while paused: remember the place, and resume() starts from it.
  if (!el.getAttribute('src')) {
    setProgress({ position: Math.max(0, seconds), duration: progress.duration })
    return
  }
  const duration = finite(el.duration) || progress.duration
  const next = Math.max(0, duration ? Math.min(duration - 0.25, seconds) : seconds)
  el.currentTime = next
  setProgress({ position: next, duration })
}

export function seekBy(seconds: number): void {
  const el = peekListenAudio()
  if (!el) return
  seekTo(el.currentTime + seconds)
}

/** Silence Listen entirely: no surah, no sleep timer, nothing on the lock screen. */
export function stopListening(): void {
  const el = peekListenAudio()
  // Nothing of Listen's is loaded: leave the lock screen to whoever is using it.
  if (!state.surah && !state.sleep && !el?.getAttribute('src')) return
  session++
  switching = false
  if (el) {
    unload(el)
    restoreVolume(el)
  }
  stopSleepTicker()
  state = IDLE
  stateListeners.forEach((listener) => listener())
  setProgress(NO_PROGRESS)
  clearLockScreen()
}

/** The same surah in another voice or narration, from the same place. */
export function changeReciter(reciterId: string): void {
  const { surah, status } = state
  if (!surah || state.reciterId === reciterId) return
  if (status === 'playing' || status === 'loading') {
    void playSurah(surah, reciterId, progress.position)
    return
  }
  const el = peekListenAudio()
  if (el) unload(el)
  setState({ reciterId, error: null })
  describe(surah, reciterId)
}

async function neighbour(fromId: number, reciterId: string, step: 1 | -1): Promise<Chapter | null> {
  let chapters: Chapter[]
  try {
    chapters = await getChapters()
  } catch {
    return null
  }
  const online = typeof navigator === 'undefined' || navigator.onLine
  for (let i = 1; i < 114; i++) {
    const id = ((((fromId - 1 + step * i) % 114) + 114) % 114) + 1
    if (!online && !isSurahAudioDownloaded(reciterId, id)) continue
    const chapter = chapters.find((c) => c.id === id)
    if (chapter) return chapter
  }
  return null
}

/** The next or previous surah that can play right now. */
export async function playNeighbour(step: 1 | -1): Promise<void> {
  const { surah, reciterId } = state
  if (!surah || !reciterId) return
  const next = await neighbour(surah.id, reciterId, step)
  if (next && state.surah?.id === surah.id) void playSurah(next, reciterId)
}

async function onEnded(): Promise<void> {
  const { surah, reciterId, sleep } = state
  if (!surah || !reciterId || switching) return
  setProgress({ position: progress.duration, duration: progress.duration })

  // Asleep, with time left: carry on into the next surah.
  if (sleep && sleep.choice !== 'surah') {
    const next = await neighbour(surah.id, reciterId, 1)
    if (next && state.sleep && state.surah?.id === surah.id) {
      void playSurah(next, reciterId)
      return
    }
  }
  if (state.sleep) endSleep()
  setState({ status: 'paused' })
  reportPlayback('paused')
}

/* ----------------------------------------------------------------- sleep */

export function lastSleepChoice(): SleepChoice {
  try {
    const raw = localStorage.getItem(SLEEP_CHOICE_KEY)
    const choice = raw === 'surah' ? 'surah' : Number(raw)
    return SLEEP_CHOICES.includes(choice as SleepChoice) ? (choice as SleepChoice) : 30
  } catch {
    return 30
  }
}

export function startSleep(choice: SleepChoice): void {
  try {
    localStorage.setItem(SLEEP_CHOICE_KEY, String(choice))
  } catch {
    // Only a memory of the last choice.
  }
  const el = peekListenAudio()
  if (el) restoreVolume(el)
  const endsAt = choice === 'surah' ? null : Date.now() + choice * 60_000
  setState({ sleep: { choice, endsAt } })
  stopSleepTicker()
  // Timers are slowed on a locked phone, so playback's own updates check too.
  if (endsAt !== null) sleepTicker = window.setInterval(checkSleep, 1000)
}

export function endSleep(): void {
  stopSleepTicker()
  const el = peekListenAudio()
  if (el) restoreVolume(el)
  if (state.sleep) setState({ sleep: null })
}

function stopSleepTicker() {
  if (sleepTicker === null) return
  window.clearInterval(sleepTicker)
  sleepTicker = null
}

function checkSleep(): void {
  const sleep = state.sleep
  if (!sleep || sleep.endsAt === null) return
  const over = Date.now() - sleep.endsAt
  if (over < 0) return
  const el = peekListenAudio()
  if (!el || el.paused || !state.surah) {
    endSleep()
    return
  }
  if (over >= FADE_MS || !canFade(el)) {
    el.pause()
    endSleep()
    return
  }
  el.volume = Math.max(0, 1 - over / FADE_MS)
}

/** iPhones keep media volume for the hardware buttons, so there the recitation simply stops. */
function canFade(el: HTMLAudioElement): boolean {
  if (volumeCanChange === null) {
    try {
      const before = el.volume
      el.volume = before === 1 ? 0.99 : 1
      volumeCanChange = el.volume !== before
      el.volume = before
    } catch {
      volumeCanChange = false
    }
  }
  return volumeCanChange
}

function restoreVolume(el: HTMLAudioElement) {
  try {
    if (el.volume !== 1) el.volume = 1
  } catch {
    // Read-only here; nothing was faded.
  }
}

export function sleepChoiceLabel(choice: SleepChoice): string {
  if (choice === 'surah') return 'End of this surah'
  return choice === 60 ? '1 hour' : `${choice} minutes`
}

/** How long until sleep mode stops the recitation, or null if that is not known yet. */
export function sleepMsLeft(sleep: ListenSleep, now: number, at: ListenProgress): number | null {
  if (sleep.endsAt !== null) return Math.max(0, sleep.endsAt - now)
  if (!at.duration) return null
  return Math.max(0, (at.duration - at.position) * 1000)
}

/** "28 min", "1 h 12 min" */
export function formatMinutesLeft(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

/** "4:05", "1:53:38" */
export function formatClock(seconds: number): string {
  const total = Math.floor(Number.isFinite(seconds) && seconds > 0 ? seconds : 0)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/* ----------------------------------------------------------- lock screen */

function hasMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
}

function describe(surah: Chapter, reciterId: string) {
  if (!hasMediaSession()) return
  const reciter = getReciterById(reciterId)
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: surah.englishName,
      artist: reciter.name,
      album: APP_NAME,
      artwork: [
        ...(reciter.photoUrl ? [{ src: reciter.photoUrl, sizes: '512x512', type: 'image/jpeg' }] : []),
        { src: '/icons/icon-512', sizes: '512x512', type: 'image/png' },
      ],
    })
  } catch {
    // Lock-screen details are a nicety.
  }
  const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
    ['play', () => resume()],
    ['pause', () => pause()],
    ['stop', () => stopListening()],
    ['seekbackward', (details) => seekBy(-(details.seekOffset ?? SKIP_SECONDS))],
    ['seekforward', (details) => seekBy(details.seekOffset ?? SKIP_SECONDS)],
    ['seekto', (details) => {
      if (typeof details.seekTime === 'number') seekTo(details.seekTime)
    }],
    ['previoustrack', () => void playNeighbour(-1)],
    ['nexttrack', () => void playNeighbour(1)],
  ]
  for (const [action, handler] of handlers) {
    try {
      navigator.mediaSession.setActionHandler(action, handler)
    } catch {
      // This browser does not offer that control.
    }
  }
}

function clearLockScreen() {
  if (!hasMediaSession()) return
  try {
    navigator.mediaSession.metadata = null
    navigator.mediaSession.playbackState = 'none'
  } catch {
    // Nothing was shown.
  }
  for (const action of ['play', 'pause', 'stop', 'seekbackward', 'seekforward', 'seekto', 'previoustrack', 'nexttrack'] as MediaSessionAction[]) {
    try {
      navigator.mediaSession.setActionHandler(action, null)
    } catch {
      // Not offered here.
    }
  }
}

function reportPlayback(value: MediaSessionPlaybackState) {
  if (!hasMediaSession()) return
  try {
    navigator.mediaSession.playbackState = value
  } catch {
    // Not offered here.
  }
}

function reportPosition() {
  const el = peekListenAudio()
  if (!el || !hasMediaSession() || !state.surah) return
  const duration = finite(el.duration)
  if (!duration) return
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: el.playbackRate || 1,
      position: Math.min(el.currentTime, duration),
    })
  } catch {
    // Not offered here.
  }
}
