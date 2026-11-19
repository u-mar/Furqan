'use client'

import { useSyncExternalStore } from 'react'
import { getListenRate, subscribeListenRate } from '@/lib/listen-player'

/** The Listen player's speed, redrawing when it changes. */
export function useListenRate(): number {
  return useSyncExternalStore(subscribeListenRate, getListenRate, () => 1)
}
