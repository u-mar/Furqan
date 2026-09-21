'use client'

import { useEffect, useState } from 'react'
import { NOTIFICATIONS_READ_EVENT, fetchUnreadCount } from '@/lib/qari-notifications'

/**
 * How many notifications the signed-in qari has not seen. Asked for when the
 * screen opens, when the app comes back to the front, and once a minute while it
 * stays open, so a like arrives without a refresh.
 */
export function useUnreadNotifications(viewer: { id: string; username: string } | null): number {
  const [unread, setUnread] = useState(0)
  const id = viewer?.id
  const username = viewer?.username

  useEffect(() => {
    if (!id || !username) {
      setUnread(0)
      return
    }
    let cancelled = false
    const load = () => {
      fetchUnreadCount({ id, username })
        .then((n) => {
          if (!cancelled) setUnread(n)
        })
        .catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    const onRead = () => setUnread(0)

    load()
    const timer = window.setInterval(load, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead)
    }
  }, [id, username])

  return unread
}
