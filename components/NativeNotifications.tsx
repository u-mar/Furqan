'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { keepHalaqaPushOn, listenForAppNotificationTaps } from '@/lib/push-client'
import { keepRemindersScheduled, listenForReminderTaps, noteReading } from '@/lib/reading-reminders'

/**
 * In the Play Store app: a tapped notification (a like, a halaqa reminder, a
 * reminder to read) opens the page it is about, and opening the mushaf counts
 * as reading, so the reading reminders move on (lib/reading-reminders.ts). A
 * halaqa member's phone is kept hearing the halaqa's reminders
 * (keepHalaqaPushOn). On the website, notifications go through the service
 * worker (public/sw.js).
 */
export default function NativeNotifications() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only pages of this site: a notification carries a path, never somewhere else.
    const open = (url: string) => {
      if (url.startsWith('/') && !url.startsWith('//')) router.push(url)
    }
    keepRemindersScheduled()
    void keepHalaqaPushOn().catch(() => {})
    const stopPush = listenForAppNotificationTaps(open)
    const stopReminders = listenForReminderTaps(open)
    return () => {
      stopPush()
      stopReminders()
    }
  }, [router])

  useEffect(() => {
    if (pathname === '/read') noteReading()
  }, [pathname])

  return null
}
