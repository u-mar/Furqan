import { tr } from '@/lib/i18n-core'

/** User is "online" if we received a heartbeat within this window. */
export const PRESENCE_ONLINE_MS = 90_000

export type UserKind = 'registered' | 'guest'

export function resolveUserKind(userId: string): UserKind {
  if (userId.startsWith('guest_') || userId === 'anon') return 'guest'
  return 'registered'
}

export function isUserOnline(lastSeenAt: number, now = Date.now()): boolean {
  return now - lastSeenAt < PRESENCE_ONLINE_MS
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return tr('just now')
  const min = Math.floor(sec / 60)
  if (min < 60) return tr('{min} min ago', { min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return tr('{hr} hr ago', { hr })
  const day = Math.floor(hr / 24)
  if (day < 7) return day === 1 ? tr('1 day ago') : tr('{day} days ago', { day })
  return new Date(ts).toLocaleString()
}

export function formatPresenceLabel(
  lastSeenAt: number,
  lastOfflineAt: number | null | undefined,
  now = Date.now()
): { status: 'online' | 'offline'; detail: string } {
  if (isUserOnline(lastSeenAt, now)) {
    return { status: 'online', detail: tr('Online now') }
  }
  const offlineSince = lastOfflineAt && lastOfflineAt <= now ? lastOfflineAt : lastSeenAt
  return {
    status: 'offline',
    detail: tr('Offline · since {time}', { time: formatRelativeTime(offlineSince, now) }),
  }
}
