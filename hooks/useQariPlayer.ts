'use client'

import { useSyncExternalStore } from 'react'
import {
  getPlayerSnapshot,
  getServerPlayerSnapshot,
  subscribePlayer,
  type PlayerSnapshot,
} from '@/lib/qari-player'

/** What the shared Qari player is doing, re-rendering as it changes. */
export function useQariPlayer(): PlayerSnapshot {
  return useSyncExternalStore(subscribePlayer, getPlayerSnapshot, getServerPlayerSnapshot)
}
