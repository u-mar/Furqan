'use client'

import { useSyncExternalStore } from 'react'

/**
 * What a recitation shows over its background: the ayah with its translation,
 * the ayah alone, or the translation alone. One choice for every recitation
 * (the viewer's, remembered on this phone), changed with the button on the
 * swipe view, and followed by the videos made to share.
 */
export type QariTextMode = 'both' | 'ayah' | 'translation'

const KEY = 'muyassar_qari_text_mode'
const ORDER: QariTextMode[] = ['both', 'ayah', 'translation']
const listeners = new Set<() => void>()

let current: QariTextMode | null = null

export function getQariTextMode(): QariTextMode {
  if (current) return current
  try {
    const saved = localStorage.getItem(KEY) as QariTextMode | null
    current = saved && ORDER.includes(saved) ? saved : 'both'
  } catch {
    current = 'both'
  }
  return current
}

/** On to the next: both → ayah only → translation only → both. Returns the new one. */
export function cycleQariTextMode(): QariTextMode {
  const next = ORDER[(ORDER.indexOf(getQariTextMode()) + 1) % ORDER.length]
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Remembered for this visit only.
  }
  for (const listener of listeners) listener()
  return next
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useQariTextMode(): QariTextMode {
  return useSyncExternalStore(subscribe, getQariTextMode, () => 'both')
}
