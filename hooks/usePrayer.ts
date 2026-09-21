'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribeAdhan, isAdhanPlaying } from '@/lib/adhan-audio'
import {
  DEFAULT_PLACE,
  DEFAULT_PRAYER_SETTINGS,
  PRAYER_CHANGED_EVENT,
  readPlace,
  readPrayerSettings,
  type Place,
  type PrayerSettings,
} from '@/lib/prayer'

/**
 * The saved place and prayer choices. They start as the defaults so the first
 * paint matches the server's, then take what the phone has saved.
 */
export function usePrayerState(): { place: Place; settings: PrayerSettings; ready: boolean } {
  const [state, setState] = useState<{ place: Place; settings: PrayerSettings; ready: boolean }>({
    place: DEFAULT_PLACE,
    settings: DEFAULT_PRAYER_SETTINGS,
    ready: false,
  })

  useEffect(() => {
    const load = () => setState({ place: readPlace(), settings: readPrayerSettings(), ready: true })
    load()
    window.addEventListener(PRAYER_CHANGED_EVENT, load)
    window.addEventListener('storage', load)
    return () => {
      window.removeEventListener(PRAYER_CHANGED_EVENT, load)
      window.removeEventListener('storage', load)
    }
  }, [])

  return state
}

/**
 * Ticks once a second, for countdowns. Null until the screen is on the phone:
 * the server cannot know the phone's clock, so drawing the time before then
 * would not match what the phone draws.
 */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function useAdhanPlaying(): boolean {
  return useSyncExternalStore(subscribeAdhan, isAdhanPlaying, () => false)
}
