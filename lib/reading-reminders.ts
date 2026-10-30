'use client'

import type { LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { tr } from '@/lib/i18n-core'
import { LAST_READ_PAGE_KEY } from '@/lib/mushaf'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'

/**
 * A gentle nudge to read, never a daily one: in the Play Store app, a
 * reminder 3 days after the last time someone read, and one more at 7 days,
 * at the hour they usually read. Reading again moves both on. Everything is
 * scheduled on the phone itself (the LocalNotifications plugin): nothing about
 * someone's reading leaves it, and it works offline.
 */

const CHOICE_KEY = 'naba-reading-reminders'
const LAST_READ_AT_KEY = 'naba-last-read-at'
const CHANNEL = 'reminders'
const IDS = [7101, 7102]
const AFTER_DAYS = [3, 7]
/** Reminders land between these hours, whatever time someone last read. */
const EARLIEST_HOUR = 7
const LATEST_HOUR = 21.5

export type ReminderChoice = 'on' | 'off' | null

export function remindersSupported(): boolean {
  return hasNativePlugin('LocalNotifications')
}

export function reminderChoice(): ReminderChoice {
  try {
    const value = localStorage.getItem(CHOICE_KEY)
    return value === 'on' || value === 'off' ? value : null
  } catch {
    return null
  }
}

function lastReadAt(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_READ_AT_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Whether this person has read in the app at all: the reminder card only asks someone who has. */
export function hasReadBefore(): boolean {
  return lastReadAt() !== null
}

/** Kept wrapped until used: an async function returning the plugin itself would never settle (lib/native-app.ts). */
const notifications = () => nativePlugin<LocalNotificationsPlugin>('LocalNotifications')

/** Where to pick up from, for the reminder's words: the surah at the top of the last page read. */
async function place(): Promise<{ page: number; surah: string | null }> {
  const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
  try {
    const res = await fetch('/quran-chapters.json', { cache: 'force-cache' })
    const { chapters } = (await res.json()) as { chapters: { name_simple: string; pages: [number, number] }[] }
    return { page, surah: chapters.find((c) => c.pages[0] <= page && page <= c.pages[1])?.name_simple ?? null }
  } catch {
    return { page, surah: null }
  }
}

/** `days` after `from`, at the time of day `from` was (kept to waking hours). */
function dayAfter(from: number, days: number): Date {
  const at = new Date(from)
  const hour = Math.min(LATEST_HOUR, Math.max(EARLIEST_HOUR, at.getHours() + at.getMinutes() / 60))
  at.setDate(at.getDate() + days)
  at.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0)
  return at
}

async function schedule(): Promise<void> {
  const { plugin: local } = await notifications()
  await local.cancel({ notifications: IDS.map((id) => ({ id })) }).catch(() => {})
  const from = lastReadAt() ?? Date.now()
  const { page, surah } = await place()
  await local
    .createChannel({ id: CHANNEL, name: tr('Reading reminders'), importance: 3 })
    .catch(() => {})
  const soonest = Date.now() + 60 * 60 * 1000
  await local.schedule({
    notifications: AFTER_DAYS.map((days, i) => {
      const at = dayAfter(from, days)
      return {
        id: IDS[i],
        title: tr('Time with the Quran'),
        body: surah ? tr('Continue {surah}, page {page}.', { surah, page }) : tr('Continue reading'),
        channelId: CHANNEL,
        // Never in the next hour: opening the app is not the moment to be reminded.
        schedule: { at: at.getTime() < soonest ? dayAfter(Date.now(), 1) : at },
        extra: { url: `/read?page=${page}` },
      }
    }),
  })
}

/** Turns reminders on (asking the phone for permission) or off. Returns whether they are on. */
export async function setReminders(on: boolean): Promise<boolean> {
  if (!remindersSupported()) return false
  const { plugin: local } = await notifications()
  if (on) {
    let { display } = await local.checkPermissions()
    if (display !== 'granted') display = (await local.requestPermissions()).display
    if (display !== 'granted') {
      localStorage.setItem(CHOICE_KEY, 'off')
      return false
    }
    localStorage.setItem(CHOICE_KEY, 'on')
    await schedule().catch(() => {})
    return true
  }
  localStorage.setItem(CHOICE_KEY, 'off')
  await local.cancel({ notifications: IDS.map((id) => ({ id })) }).catch(() => {})
  return false
}

/** Someone is reading now: both reminders move on from this moment. */
export function noteReading(): void {
  try {
    localStorage.setItem(LAST_READ_AT_KEY, String(Date.now()))
  } catch {
    return
  }
  if (remindersSupported() && reminderChoice() === 'on') void schedule().catch(() => {})
}

/** On opening the app: puts the reminders back if they are on (after a phone restart or an update). */
export function keepRemindersScheduled(): void {
  if (remindersSupported() && reminderChoice() === 'on') void schedule().catch(() => {})
}

/** Opens the page a tapped reminder points to (where they left off). Returns a function that stops listening. */
export function listenForReminderTaps(open: (url: string) => void): () => void {
  if (!remindersSupported()) return () => {}
  let stopped = false
  let handle: { remove: () => Promise<void> } | null = null
  void notifications()
    .then(({ plugin: local }) =>
      local.addListener('localNotificationActionPerformed', ({ notification }) => {
        const url = (notification.extra as { url?: unknown } | undefined)?.url
        if (typeof url === 'string') open(url)
      })
    )
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
