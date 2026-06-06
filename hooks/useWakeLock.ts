'use client'

import { useEffect } from 'react'

/** Keeps the screen awake while audio playback is active (e.g. recitation). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const requestLock = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        if (lock && !lock.released) return
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          lock = null
        })
      } catch {
        /* unsupported or denied */
      }
    }

    void requestLock()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) void requestLock()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      lock?.release().catch(() => {})
      lock = null
    }
  }, [active])
}
