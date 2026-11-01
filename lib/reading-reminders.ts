'use client'

import type { LocalNotificationsPlugin } from '@capacitor/local-notifications'
import { currentLanguage, tr } from '@/lib/i18n-core'
import { LAST_READ_PAGE_KEY } from '@/lib/mushaf'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'

/**
 * A gentle nudge to read, never a daily one: in the Play Store app, a
 * reminder 3 days after the last time someone read, and one more at 7 days,
 * at the hour they usually read. Reading again moves both on. Everything is
 * scheduled on the phone itself (the LocalNotifications plugin): nothing about
 * someone's reading leaves it, and it works offline.
 *
 * Nothing asks about them: they are on wherever the phone allows Naba's
 * notifications (asked when the app first opens), until turned off in Settings.
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

/** Kept wrapped until used: an async function returning the plugin itself would never settle (lib/native-app.ts). */
const notifications = () => nativePlugin<LocalNotificationsPlugin>('LocalNotifications')

/**
 * Whether reminders are on: turned on in Settings, or never touched and the
 * phone allows Naba's notifications. Turned off in Settings, they stay off.
 */
export async function remindersOn(): Promise<boolean> {
  if (!remindersSupported()) return false
  const choice = reminderChoice()
  if (choice !== null) return choice === 'on'
  try {
    const { plugin: local } = await notifications()
    return (await local.checkPermissions()).display === 'granted'
  } catch {
    return false
  }
}

/** The two reminders' words: after three days, and after a week. */
function reminderText(index: number, place: { page: number; surah: string | null }): { title: string; body: string } {
  const { page, surah } = place
  if (index === 0) {
    return {
      title: tr('Time with the Quran'),
      body: surah ? tr('Pick up where you left off: {surah}, page {page}.', { surah, page }) : tr('Pick up where you left off.'),
    }
  }
  return {
    title: tr('A few ayat today?'),
    body: surah
      ? tr('It has been a week. {surah}, page {page} is where you stopped.', { surah, page })
      : tr('It has been a week since you last read.'),
  }
}

/** Where to pick up from, for the reminder's words: the surah at the top of the last page read. */
async function place(): Promise<{ page: number; surah: string | null }> {
  const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
  try {
    const res = await fetch('/quran-chapters.json', { cache: 'force-cache' })
    const { chapters } = (await res.json()) as {
      chapters: { name_simple: string; name_arabic: string; pages: [number, number] }[]
    }
    const chapter = chapters.find((c) => c.pages[0] <= page && page <= c.pages[1])
    // In Arabic, the surah's own name.
    return { page, surah: chapter ? (currentLanguage() === 'ar' ? chapter.name_arabic : chapter.name_simple) : null }
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
        ...reminderText(i, { page, surah }),
        channelId: CHANNEL,
        // A reminder may come a few minutes either way. Asking for an exact one makes the plugin open
        // Android's "Alarms & reminders" settings on every schedule where that is not allowed; only
        // the adhan asks for it, from the Prayer screen (lib/native-adhan.ts).
        isExactNotification: false,
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
  void remindersOn()
    .then((on) => (on ? schedule() : undefined))
    .catch(() => {})
}

/** On opening the app: puts the reminders back if they are on (after a phone restart or an update). */
export function keepRemindersScheduled(): void {
  void remindersOn()
    .then((on) => (on ? schedule() : undefined))
    .catch(() => {})
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
