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

/** What a card that is not the one playing sees: always the same, so it does not redraw. */
const NOT_THIS_ONE: PlayerSnapshot = { current: null, status: 'idle', position: 0, duration: 0, rate: 1 }

/**
 * The player as one recitation's card needs it: the full snapshot while that recitation is the one
 * loaded, and a fixed "not this one" otherwise. Every card used to redraw several times a second while
 * anything played, which on a profile or list of dozens of cards made Qari stutter.
 */
export function useQariPlayerFor(recitationId: string): PlayerSnapshot {
  const select = () => {
    const snapshot = getPlayerSnapshot()
    return snapshot.current?.id === recitationId ? snapshot : NOT_THIS_ONE
  }
  return useSyncExternalStore(subscribePlayer, select, () => NOT_THIS_ONE)
}

/** Whether the player has a recitation loaded, redrawing only when that changes. */
export function useQariPlayerLoaded(): boolean {
  return useSyncExternalStore(subscribePlayer, () => Boolean(getPlayerSnapshot().current), () => false)
}
