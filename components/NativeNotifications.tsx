'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useViewer } from '@/hooks/useViewer'
import { keepHalaqaPushOn, keepQariPushOn, listenForAppNotificationTaps } from '@/lib/push-client'
import { listenForReminderTaps, stopReadingReminders } from '@/lib/reading-reminders'

/**
 * In the Play Store app: a tapped notification (a like, a halaqa reminder, or
 * an old reminder to read) opens the page it is about. The daily reminders to
 * read are no longer scheduled, and any left from before are cancelled
 * (lib/reading-reminders.ts). A signed-in qari's phone, and a halaqa member's, is kept hearing about them
 * (keepQariPushOn, keepHalaqaPushOn). On the website, notifications go through
 * the service worker (public/sw.js).
 */
export default function NativeNotifications() {
  const router = useRouter()
  const viewer = useViewer()
  const viewerId = viewer?.id
  const viewerUsername = viewer?.username

  useEffect(() => {
    // Only pages of this site: a notification carries a path, never somewhere else.
    const open = (url: string) => {
      if (url.startsWith('/') && !url.startsWith('//')) router.push(url)
    }
    // The daily reminders to read are gone: any left on the phone from before are cancelled.
    stopReadingReminders()
    void keepHalaqaPushOn().catch(() => {})
    const stopPush = listenForAppNotificationTaps(open)
    const stopReminders = listenForReminderTaps(open)
    return () => {
      stopPush()
      stopReminders()
    }
  }, [router])

  // Signed in, or signed in as someone else: this phone hears about that account's likes and followers.
  useEffect(() => {
    if (viewerId && viewerUsername) void keepQariPushOn({ id: viewerId, username: viewerUsername }).catch(() => {})
  }, [viewerId, viewerUsername])

  return null
}
