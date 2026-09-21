'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications'
import { useViewer } from '@/hooks/useViewer'
import { tapFeedback } from '@/lib/haptics'
import { useT } from '@/lib/i18n'

/** The bell on the Qari feed: opens the list, and shows how many are new. */
export default function NotificationsBell() {
  const t = useT()
  const viewer = useViewer()
  const unread = useUnreadNotifications(viewer)
  if (!viewer) return null

  return (
    <Link
      href="/qari/notifications"
      onClick={tapFeedback}
      className="home-round ed-focus relative"
      aria-label={unread > 0 ? t('Notifications, {count} new', { count: unread }) : t('Notifications')}
    >
      <Bell className="h-[19px] w-[19px]" strokeWidth={1.9} />
      {unread > 0 ? (
        <span
          className="qari-pop absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10.5px] font-bold leading-none text-white ring-2 ring-[var(--app-bg)]"
          aria-hidden
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Link>
  )
}
