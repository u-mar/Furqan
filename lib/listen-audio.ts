'use client'

import { revokePlayableAyahAudioUrl } from '@/lib/offline-audio'

/**
 * The Listen player's audio element, owned by the module rather than the
 * screen.
 *
 * A recitation should keep playing when you step back to the home screen —
 * an element created inside the component would be torn down the moment the
 * route unmounted. Anything that genuinely conflicts with listening (Read,
 * Test, Qari) stops it explicitly instead; see ListenPlaybackGuard.
 */

export interface ListenNowPlaying {
  surahId: number
  surahName: string
  versesCount: number
}

let element: HTMLAudioElement | null = null
let nowPlaying: ListenNowPlaying | null = null
let objectUrl: string | null = null

export function getListenAudio(): HTMLAudioElement {
  if (!element) element = new Audio()
  return element
}

/** The element without creating one — for code that only wants to stop it. */
export function peekListenAudio(): HTMLAudioElement | null {
  return element
}

export function getListenNowPlaying(): ListenNowPlaying | null {
  return nowPlaying
}

export function setListenNowPlaying(value: ListenNowPlaying | null): void {
  nowPlaying = value
}

/** Blob URLs for offline audio outlive the screen too, so they live here. */
export function setListenObjectUrl(url: string | null): void {
  if (objectUrl && objectUrl !== url) revokePlayableAyahAudioUrl(objectUrl)
  objectUrl = url
}

export function clearListenObjectUrl(): void {
  if (objectUrl) revokePlayableAyahAudioUrl(objectUrl)
  objectUrl = null
}

/** Stop and unload — used when leaving for a screen that has its own audio. */
export function stopListenAudio(): void {
  if (!element) return
  element.pause()
  clearListenObjectUrl()
  element.removeAttribute('src')
  element.load()
  nowPlaying = null
}

export function isListenAudioActive(): boolean {
  return Boolean(element && !element.paused && !element.ended)
}
