'use client'

import type { PushNotificationsPlugin } from '@capacitor/push-notifications'
import { halaqaKey, isHalaqaMember } from '@/lib/halaqa'
import { currentLanguage, tr } from '@/lib/i18n-core'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'

/**
 * Turning on notifications for this phone. The person has to say yes (from a
 * tap: phones refuse to ask otherwise), the phone hands back an address for
 * the push service, and the server keeps it against their account.
 *
 * In the Play Store app, whose WebView has no web push, the address is the
 * phone's Firebase token instead, sent as "fcm:<token>" (lib/fcm.ts delivers
 * to those). Everything else is the same either way.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

interface Viewer {
  id: string
  username: string
}

export type PushState =
  /** This browser cannot receive them at all. */
  | 'unsupported'
  /** An iPhone that has not had the app added to its home screen: Apple only allows it there. */
  | 'needs-install'
  /** The server has no keys yet. */
  | 'unconfigured'
  | 'blocked'
  | 'off'
  | 'on'

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=').replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

const isIPhone = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/* -------------------------------------------------- the Play Store app */

const FCM_TOKEN_KEY = 'naba-fcm-token'

/** A phone address in the shape the server takes, from a web push subscription or a Firebase token. */
interface Address {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

const inApp = () => hasNativePlugin('NabaApp')

let pushReady: Promise<boolean> | null = null

/** Whether this copy of the app was built with Firebase (android/…/NabaAppPlugin.java): asking without it crashes. */
function appPushReady(): Promise<boolean> {
  pushReady ??= (async () => {
    if (!hasNativePlugin('PushNotifications')) return false
    const { plugin } = await nativePlugin<{ info: () => Promise<{ pushReady: boolean }> }>('NabaApp')
    return (await plugin.info()).pushReady
  })().catch(() => false)
  return pushReady
}

/** Kept wrapped until used: an async function returning the plugin itself would never settle (lib/native-app.ts). */
const appPush = () => nativePlugin<PushNotificationsPlugin>('PushNotifications')

function savedToken(): string | null {
  try {
    return localStorage.getItem(FCM_TOKEN_KEY)
  } catch {
    return null
  }
}

async function appPushState(): Promise<PushState> {
  if (!(await appPushReady())) return 'unsupported'
  const { plugin: push } = await appPush()
  const { receive } = await push.checkPermissions()
  if (receive === 'denied') return 'blocked'
  return receive === 'granted' && savedToken() ? 'on' : 'off'
}

/** This phone's Firebase address, asking permission first when `ask`. Null when there is none to be had. */
async function appAddress(ask: boolean): Promise<Address | 'blocked' | null> {
  const { plugin: push } = await appPush()
  let { receive } = await push.checkPermissions()
  if (receive !== 'granted' && ask) receive = (await push.requestPermissions()).receive
  if (receive === 'denied') return 'blocked'
  if (receive !== 'granted') return null
  const token = await new Promise<string | null>((resolve) => {
    const handles: Promise<{ remove: () => Promise<void> }>[] = []
    const timer = window.setTimeout(() => finish(null), 15_000)
    function finish(value: string | null) {
      window.clearTimeout(timer)
      handles.forEach((handle) => void handle.then((h) => h.remove()))
      resolve(value)
    }
    handles.push(push.addListener('registration', ({ value }) => finish(value)))
    handles.push(push.addListener('registrationError', () => finish(null)))
    push.register().catch(() => finish(null))
  })
  if (!token) return null
  localStorage.setItem(FCM_TOKEN_KEY, token)
  return { endpoint: `fcm:${token}`, keys: { p256dh: '', auth: '' } }
}

/** Forgets this phone's Firebase address: on the server (`remove`), and Firebase's own. */
async function appForget(remove: (endpoint: string) => Promise<unknown>): Promise<PushState> {
  if (!(await appPushReady())) return 'unsupported'
  const token = savedToken()
  if (token) await remove(`fcm:${token}`).catch(() => {})
  localStorage.removeItem(FCM_TOKEN_KEY)
  const { plugin: push } = await appPush()
  await push.unregister().catch(() => {})
  return appPushState()
}

/* --------------------------------------------------------------- the web */

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
  } catch {
    return null
  }
}

export async function pushState(): Promise<PushState> {
  if (typeof window === 'undefined') return 'unsupported'
  if (inApp()) return appPushState()
  if (!PUBLIC_KEY) return 'unconfigured'
  if (isIPhone() && !isInstalled()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

async function save(viewer: Viewer, subscription: PushSubscription | Address): Promise<boolean> {
  const res = await fetch('/api/qari/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: viewer.username, userId: viewer.id, subscription: 'toJSON' in subscription ? subscription.toJSON() : subscription }),
  }).catch(() => null)
  return Boolean(res?.ok)
}

/** Ask permission and subscribe. Must be called from a tap. Returns the new state. */
export async function enablePush(viewer: Viewer): Promise<PushState> {
  const state = await pushState()
  if (state !== 'off') return state
  if (inApp()) {
    const address = await appAddress(true)
    if (address === 'blocked' || !address) return address ?? 'off'
    return (await save(viewer, address)) ? 'on' : 'off'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await registration()
  if (!reg) return 'unsupported'
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(PUBLIC_KEY) }))
    return (await save(viewer, subscription)) ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export async function disablePush(viewer: Viewer): Promise<PushState> {
  if (inApp()) {
    return appForget((endpoint) =>
      fetch('/api/qari/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: viewer.username, userId: viewer.id, endpoint }),
      })
    )
  }
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await fetch('/api/qari/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: viewer.username, userId: viewer.id, endpoint: sub.endpoint }),
    }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  return pushState()
}

/**
 * Where notifications are already allowed, tell the server about this phone
 * again. It keeps the account's phones right after signing in as someone else,
 * a database reset, or the push service changing the phone's address.
 */
export async function syncPush(viewer: Viewer): Promise<void> {
  if ((await pushState()) !== 'on') return
  if (inApp()) {
    const address = await appAddress(false)
    if (address && address !== 'blocked') await save(viewer, address)
    return
  }
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await save(viewer, sub)
}

/* --------------------------------------------------------- halaqa reminders */

/** Kept with the address: the language reminders reach this phone in. */
async function saveHalaqa(subscription: PushSubscription | Address): Promise<boolean> {
  const res = await fetch('/api/halaqa/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-halaqa-key': halaqaKey() },
    body: JSON.stringify({
      subscription: 'toJSON' in subscription ? subscription.toJSON() : subscription,
      language: currentLanguage(),
    }),
  }).catch(() => null)
  return Boolean(res?.ok)
}

const HALAQA_CHOICE_KEY = 'naba-halaqa-reminders'

/** Remembers a halaqa member turning reminders off (or back on), so they are not turned on for them again. */
function setHalaqaChoice(on: boolean): void {
  try {
    localStorage.setItem(HALAQA_CHOICE_KEY, on ? 'on' : 'off')
  } catch {
    // Only a memory of the choice.
  }
}

function turnedHalaqaOff(): boolean {
  try {
    return localStorage.getItem(HALAQA_CHOICE_KEY) === 'off'
  } catch {
    return false
  }
}

/**
 * On opening the app or a halaqa. In the Play Store app, a halaqa member hears
 * the reminders the others send without turning them on, wherever the phone
 * already allows Naba's notifications (asked when the app first opens): this
 * never asks. On the website they stay a choice. Either way the server hears
 * this phone's address and language again. Turned off, they stay off.
 */
export async function keepHalaqaPushOn(): Promise<void> {
  if (typeof window === 'undefined' || !isHalaqaMember() || turnedHalaqaOff()) return
  if (inApp()) {
    if (!(await appPushReady())) return
    const address = await appAddress(false)
    if (address && address !== 'blocked') await saveHalaqa(address)
    return
  }
  await syncHalaqaPush()
}

/** Same flow as enablePush, for the reminders other halaqa members send — no account needed. */
export async function enableHalaqaPush(): Promise<PushState> {
  setHalaqaChoice(true)
  const state = await pushState()
  // Already allowed (for Qari, say): this halaqa only needs telling.
  if (state === 'on') {
    await syncHalaqaPush()
    return state
  }
  if (state !== 'off') return state
  if (inApp()) {
    const address = await appAddress(true)
    if (address === 'blocked' || !address) return address ?? 'off'
    return (await saveHalaqa(address)) ? 'on' : 'off'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const reg = await registration()
  if (!reg) return 'unsupported'
  try {
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(PUBLIC_KEY) }))
    return (await saveHalaqa(subscription)) ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export async function disableHalaqaPush(): Promise<PushState> {
  setHalaqaChoice(false)
  if (inApp()) {
    return appForget((endpoint) =>
      fetch('/api/halaqa/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-halaqa-key': halaqaKey() },
        body: JSON.stringify({ endpoint }),
      })
    )
  }
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await fetch('/api/halaqa/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'x-halaqa-key': halaqaKey() },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  return pushState()
}

/** Where notifications are already allowed, tell the server about this phone again — same as syncPush. */
export async function syncHalaqaPush(): Promise<void> {
  if ((await pushState()) !== 'on') return
  if (inApp()) {
    const address = await appAddress(false)
    if (address && address !== 'blocked') await saveHalaqa(address)
    return
  }
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await saveHalaqa(sub)
}

/**
 * In the Play Store app: makes the "Qari and halaqa" channel Firebase messages
 * arrive in (lib/fcm.ts), and opens the page a tapped one points to. Returns
 * a function that stops listening.
 */
export function listenForAppNotificationTaps(open: (url: string) => void): () => void {
  let stopped = false
  let handle: { remove: () => Promise<void> } | null = null
  void (async () => {
    if (!inApp() || !(await appPushReady()) || stopped) return
    const { plugin: push } = await appPush()
    await push.createChannel({ id: 'activity', name: tr('Qari and halaqa'), importance: 4 }).catch(() => {})
    handle = await push.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const url = (notification.data as { url?: unknown } | undefined)?.url
      if (typeof url === 'string') open(url)
    })
    if (stopped) void handle.remove()
  })().catch(() => {})
  return () => {
    stopped = true
    void handle?.remove()
  }
}
