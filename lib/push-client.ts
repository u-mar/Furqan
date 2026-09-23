'use client'

import { halaqaKey } from '@/lib/halaqa'

/**
 * Turning on notifications for this phone. The person has to say yes (from a
 * tap: phones refuse to ask otherwise), the phone hands back an address for
 * the push service, and the server keeps it against their account.
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
  if (!PUBLIC_KEY) return 'unconfigured'
  if (isIPhone() && !isInstalled()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub ? 'on' : 'off'
}

async function save(viewer: Viewer, subscription: PushSubscription): Promise<boolean> {
  const res = await fetch('/api/qari/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: viewer.username, userId: viewer.id, subscription: subscription.toJSON() }),
  }).catch(() => null)
  return Boolean(res?.ok)
}

/** Ask permission and subscribe. Must be called from a tap. Returns the new state. */
export async function enablePush(viewer: Viewer): Promise<PushState> {
  const state = await pushState()
  if (state !== 'off') return state
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
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await save(viewer, sub)
}

/* --------------------------------------------------------- halaqa reminders */

async function saveHalaqa(subscription: PushSubscription): Promise<boolean> {
  const res = await fetch('/api/halaqa/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-halaqa-key': halaqaKey() },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  }).catch(() => null)
  return Boolean(res?.ok)
}

/** Same flow as enablePush, for the reminders other halaqa members send — no account needed. */
export async function enableHalaqaPush(): Promise<PushState> {
  const state = await pushState()
  if (state !== 'off') return state
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
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) await saveHalaqa(sub)
}
