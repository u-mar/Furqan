import { tr } from '@/lib/i18n-core'

export interface QariNotification {
  id: string
  type: 'like' | 'follow' | 'milestone'
  actorUsername: string
  actorName: string
  recitationId: string | null
  recitationTitle: string | null
  /** Only for type "milestone". */
  milestoneKind: 'plays' | 'likes' | null
  milestoneCount: number | null
  createdAt: string
  read: boolean
}

interface Viewer {
  id: string
  username: string
}

const query = (viewer: Viewer) =>
  `username=${encodeURIComponent(viewer.username)}&userId=${encodeURIComponent(viewer.id)}`

/** Tells the badge, wherever it is, that the list has been seen. */
export const NOTIFICATIONS_READ_EVENT = 'qari-notifications-read'

export async function fetchUnreadCount(viewer: Viewer): Promise<number> {
  const res = await fetch(`/api/qari/notifications?${query(viewer)}&count=1`, { cache: 'no-store' })
  if (!res.ok) return 0
  const data = (await res.json().catch(() => ({}))) as { unread?: number }
  return data.unread ?? 0
}

export async function fetchNotifications(viewer: Viewer): Promise<QariNotification[]> {
  const res = await fetch(`/api/qari/notifications?${query(viewer)}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(tr('Could not load notifications.'))
  const data = (await res.json()) as { items?: QariNotification[] }
  return data.items ?? []
}

export async function markNotificationsRead(viewer: Viewer): Promise<void> {
  await fetch('/api/qari/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: viewer.username, userId: viewer.id }),
  }).catch(() => {})
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT))
}
