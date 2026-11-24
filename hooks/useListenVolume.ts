'use client'

import { useSyncExternalStore } from 'react'
import { getListenVolume, subscribeListenVolume } from '@/lib/listen-player'

/** The recitation's own volume (0 to 1), redrawing when it changes. */
export function useListenVolume(): number {
  return useSyncExternalStore(subscribeListenVolume, getListenVolume, () => 1)
}
