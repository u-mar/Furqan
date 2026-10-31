'use client'

import { currentLanguage, tr } from '@/lib/i18n-core'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'
import { ADHAN_PRAYERS, PRAYER_NAMES, formatTime, prayerTimesFor, type Place, type PrayerId, type PrayerSettings } from '@/lib/prayer'

/**
 * The adhan in the Play Store app, the app open or closed: the coming weeks'
 * prayer times are worked out here, on the phone, and handed to the app
 * (android/…/NabaAdhanPlugin.java), which has Android wake it at each one and
 * sound the adhan in a notification. Every open of the app renews the list, so
 * it only runs out for someone who has not opened Naba in DAYS days.
 */

const DAYS = 60

export interface AdhanStatus {
  /** Whether Android lets it sound on the minute ("Alarms & reminders"); without, it can be minutes late. */
  exact: boolean
  /** Whether its notifications can show at all: without them there is no adhan. */
  notifications: boolean
}

interface AdhanTime {
  at: number
  prayer: PrayerId
  title: string
  body: string
}

interface NabaAdhanPlugin {
  schedule(options: { times: AdhanTime[]; labels: Record<string, string> }): Promise<AdhanStatus>
  cancel(): Promise<void>
  status(): Promise<AdhanStatus>
  openSettings(options: { page: 'alarms' | 'notifications' }): Promise<void>
  addListener(event: 'adhan', listener: (event: { prayer: string }) => void): Promise<{ remove: () => Promise<void> }>
}

/** Kept wrapped until used: an async function returning the plugin itself would never settle (lib/native-app.ts). */
const adhan = () => nativePlugin<NabaAdhanPlugin>('NabaAdhan')

export function nativeAdhanSupported(): boolean {
  return hasNativePlugin('NabaAdhan')
}

/** "Subax (Fajr)" → "Subax". */
function prayerName(id: PrayerId): string {
  return tr(PRAYER_NAMES[id]).replace(/\s*\(.*\)\s*$/, '')
}

/** Every adhan still to come in the next DAYS days, with its words in the app's language. */
function upcoming(place: Place, settings: PrayerSettings, now: Date): AdhanTime[] {
  const language = currentLanguage()
  const times: AdhanTime[] = []
  const seen = new Set<number>()
  for (let day = 0; day <= DAYS; day++) {
    // Midday, so a clock change never skips or repeats a day.
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, 12)
    const dayTimes = prayerTimesFor(place, date, settings)
    for (const id of ADHAN_PRAYERS) {
      if (!settings.adhanFor[id as Exclude<PrayerId, 'sunrise'>]) continue
      const at = dayTimes[id].getTime()
      if (!Number.isFinite(at) || at <= now.getTime() || seen.has(at)) continue
      seen.add(at)
      const name = prayerName(id)
      times.push({
        at,
        prayer: id,
        title: `${name} · ${formatTime(dayTimes[id], language, place.timeZone)}`,
        body: tr('It is time for {prayer} prayer.', { prayer: name }),
      })
    }
  }
  return times
}

/**
 * Hands the coming adhans to the app, or takes them back when the adhan is
 * off. Returns what Android allows, or null outside the app.
 */
export async function scheduleNativeAdhan(place: Place, settings: PrayerSettings): Promise<AdhanStatus | null> {
  if (!nativeAdhanSupported()) return null
  const { plugin } = await adhan()
  const times = settings.adhan ? upcoming(place, settings, new Date()) : []
  if (times.length === 0) {
    await plugin.cancel()
    return plugin.status()
  }
  return plugin.schedule({ times, labels: { channel: tr('Adhan'), fajrChannel: tr('Fajr adhan'), stop: tr('Stop') } })
}

export async function nativeAdhanStatus(): Promise<AdhanStatus | null> {
  if (!nativeAdhanSupported()) return null
  const { plugin } = await adhan()
  return plugin.status()
}

/** Android's own page for the app, where "Alarms & reminders" or its notifications are turned on. */
export async function openAdhanSettings(page: 'alarms' | 'notifications'): Promise<void> {
  if (!nativeAdhanSupported()) return
  const { plugin } = await adhan()
  await plugin.openSettings({ page })
}

/** Calls `onAdhan` when the adhan begins while the app is open. Returns a function that stops listening. */
export function listenForNativeAdhan(onAdhan: () => void): () => void {
  if (!nativeAdhanSupported()) return () => {}
  let stopped = false
  let handle: { remove: () => Promise<void> } | null = null
  void adhan()
    .then(({ plugin }) => plugin.addListener('adhan', onAdhan))
    .then((h) => {
      handle = h
      if (stopped) void h.remove()
    })
    .catch(() => {})
  return () => {
    stopped = true
    void handle?.remove()
  }
}
