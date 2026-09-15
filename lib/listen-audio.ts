'use client'

import { revokePlayableAyahAudioUrl } from '@/lib/offline-audio'

/**
 * The Listen player's audio element, owned by the module rather than the
 * screen.
 *
 * A recitation should keep playing when you step back to the home screen —
 * an element created inside the component would be torn down the moment the
 * route unmounted. Anything that genuinely conflicts with listening (Read,
 * Qari) stops it explicitly instead; see ListenPlaybackGuard.
 */

let element: HTMLAudioElement | null = null
let objectUrl: string | null = null

export function getListenAudio(): HTMLAudioElement {
  if (!element) {
    element = new Audio()
    element.preload = 'auto'
  }
  return element
}

/** The element without creating one — for code that only wants to stop it. */
export function peekListenAudio(): HTMLAudioElement | null {
  return element
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
