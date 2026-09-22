'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { subscribeAdhan, isAdhanPlaying } from '@/lib/adhan-audio'
import {
  DEFAULT_PLACE,
  DEFAULT_PRAYER_SETTINGS,
  PRAYER_CHANGED_EVENT,
  distanceKm,
  locateDevice,
  locationDenied,
  readPlace,
  readPrayerSettings,
  savePlace,
  setLocationDenied,
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

/**
 * Finds the phone's position by itself, quietly. The first time, this is what
 * brings up the phone's own "allow location?" question; if that was refused
 * it is not asked again on every visit. Afterwards the position is kept up
 * to date, so prayer times and the qibla follow the person when they travel.
 * Shared by the Prayer and Qibla screens so both stay in step.
 */
export function useAutoLocate(ready: boolean, place: Place): void {
  useEffect(() => {
    if (!ready) return
    if (place.source === 'device') {
      void locateDevice()
        .then((fresh) => {
          if (distanceKm(fresh, place) > 3) savePlace(fresh)
        })
        .catch(() => {})
      return
    }
    if (locationDenied()) return
    void locateDevice()
      .then((fresh) => savePlace(fresh))
      .catch((err) => {
        if (err instanceof Error && err.message === 'denied') setLocationDenied(true)
      })
    // Only when the screen opens, and again if the saved place changes kind.
  }, [ready, place.source])
}
