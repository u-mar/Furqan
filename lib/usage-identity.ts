'use client'

import { getSignedInUser } from '@/lib/auth'

const DEVICE_ID_KEY = 'muyassar_device_id'

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
      deviceId = `guest_${crypto.randomUUID()}`
      localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return { userId: deviceId, userName: 'Guest' }
  } catch {
    return { userId: 'anon', userName: 'Guest' }
  }
}
