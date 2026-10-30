'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
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
 * Whether the phone hands over its position: 'granted', 'denied' (it will not
 * ask again; only its settings can turn location back on) or 'prompt'. Null
 * where the browser cannot say, as on older iPhones.
 */
async function locationPermission(): Promise<PermissionState | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null
    return (await navigator.permissions.query({ name: 'geolocation' })).state
  } catch {
    return null
  }
}

/**
 * Where the position stands: still being found, found ('on'), refused but
 * the phone can still ask ('off'), or blocked in the phone's settings.
 */
export type LocateStatus = 'locating' | 'on' | 'off' | 'blocked'

/**
 * Finds the phone's position by itself; there is no place to pick. The first
 * time, this is what brings up the phone's own "allow location?" question. If
 * that was refused it is not asked again on every visit, but allowing it later
 * in the phone's settings is picked up on the next visit. Afterwards the
 * position is kept up to date, so prayer times and the qibla follow the
 * person when they travel. Shared by Home, Prayer and Qibla so all three stay
 * in step. `retry` asks again, from a tap.
 */
export function useAutoLocate(ready: boolean, place: Place): { status: LocateStatus; retry: () => void } {
  const [status, setStatus] = useState<LocateStatus>('locating')

  useEffect(() => {
    if (!ready) return
    let alive = true
    const finish = (next: LocateStatus) => {
      if (alive) setStatus(next)
    }
    // A position found before still stands while a fresh one cannot be had.
    const fallback = (blocked: boolean): LocateStatus => (place.source === 'device' ? 'on' : blocked ? 'blocked' : 'off')

    void (async () => {
      const permission = await locationPermission()
      if (permission === 'denied') {
        setLocationDenied(true)
        finish(fallback(true))
        return
      }
      if (permission !== 'granted' && place.source !== 'device' && locationDenied()) {
        finish(fallback(false))
        return
      }
      try {
        const fresh = await locateDevice()
        if (place.source !== 'device' || distanceKm(fresh, place) > 3) savePlace(fresh)
        finish('on')
      } catch (err) {
        const denied = err instanceof Error && err.message === 'denied'
        if (denied) setLocationDenied(true)
        finish(fallback(denied && (await locationPermission()) === 'denied'))
      }
    })()

    return () => {
      alive = false
    }
    // Only when the screen opens, and again if the saved place changes kind.
  }, [ready, place.source])

  const retry = useCallback(() => {
    setStatus('locating')
    void locateDevice()
      .then((fresh) => {
        savePlace(fresh)
        setStatus('on')
      })
      .catch(async (err) => {
        const denied = err instanceof Error && err.message === 'denied'
        if (denied) setLocationDenied(true)
        setStatus(denied && (await locationPermission()) === 'denied' ? 'blocked' : 'off')
      })
  }, [])

  // The Play Store app asks Android itself the first time it opens (android/…/MainActivity.java),
  // and says so once the answer is yes: the position is found then, whatever this screen was told
  // while the question was up.
  useEffect(() => {
    const allowed = () => {
      setLocationDenied(false)
      retry()
    }
    window.addEventListener('nabalocationallowed', allowed)
    return () => window.removeEventListener('nabalocationallowed', allowed)
  }, [retry])

  return { status, retry }
}
