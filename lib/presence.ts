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
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`
  return new Date(ts).toLocaleString()
}

export function formatPresenceLabel(
  lastSeenAt: number,
  lastOfflineAt: number | null | undefined,
  now = Date.now()
): { status: 'online' | 'offline'; detail: string } {
  if (isUserOnline(lastSeenAt, now)) {
    return { status: 'online', detail: 'Online now' }
  }
  const offlineSince = lastOfflineAt && lastOfflineAt <= now ? lastOfflineAt : lastSeenAt
  return {
    status: 'offline',
    detail: `Offline · since ${formatRelativeTime(offlineSince, now)}`,
  }
}
