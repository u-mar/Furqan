'use client'

import { getSignedInUser } from '@/lib/auth'

const DEVICE_ID_KEY = 'muyassar_device_id'
const FIRST_SEEN_KEY = 'muyassar_first_seen_at'

/** When this browser profile first opened the app (ms). Used to skip old admin popups. */
export function getFirstSeenAt(): number {
  if (typeof window === 'undefined') return Date.now()
  try {
    const raw = localStorage.getItem(FIRST_SEEN_KEY)
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
    const now = Date.now()
    localStorage.setItem(FIRST_SEEN_KEY, String(now))
    return now
  } catch {
    return Date.now()
  }
}

/** Stable id for signed-in users or guests (for usage analytics). */
export function getUsageIdentity(): { userId: string; userName: string } {
  const signedIn = getSignedInUser()
  if (signedIn) {
    return { userId: signedIn.id, userName: signedIn.name }
  }

  if (typeof window === 'undefined') {
    return { userId: 'anon', userName: 'Guest' }
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
      const now = Date.now()
      deviceId = `guest_${crypto.randomUUID()}`
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
      localStorage.setItem(FIRST_SEEN_KEY, String(now))
    }
    return { userId: deviceId, userName: 'Guest' }
  } catch {
    return { userId: 'anon', userName: 'Guest' }
  }
}
