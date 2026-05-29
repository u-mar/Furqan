import type { UserUsage as PrismaUserUsage } from '@prisma/client'
import {
  formatPresenceLabel,
  isUserOnline,
  resolveUserKind,
  type UserKind,
} from '@/lib/presence'

export interface AdminUserUsage {
  userId: string
  userName: string
  userKind: UserKind
  createdAt: number
  lastSeenAt: number
  lastOfflineAt: number | null
  isOnline: boolean
  presenceLabel: string
  presenceDetail: string
  totalVisits: number
  lastPath: string
  pageViews: Record<string, number>
}

export function mapAdminUser(user: PrismaUserUsage, now = Date.now()): AdminUserUsage {
  const lastSeenAt = user.lastSeenAt.getTime()
  const lastOfflineAt = user.lastOfflineAt?.getTime() ?? null
  const userKind =
    user.userKind === 'registered' || user.userKind === 'guest'
      ? (user.userKind as UserKind)
      : resolveUserKind(user.userId)
  const presence = formatPresenceLabel(lastSeenAt, lastOfflineAt, now)

  return {
    userId: user.userId,
    userName: user.userName,
    userKind,
    createdAt: user.createdAt.getTime(),
    lastSeenAt,
    lastOfflineAt,
    isOnline: isUserOnline(lastSeenAt, now),
    presenceLabel: presence.status === 'online' ? 'Online' : 'Offline',
    presenceDetail: presence.detail,
    totalVisits: user.totalVisits,
    lastPath: user.lastPath,
    pageViews:
      typeof user.pageViews === 'object' && user.pageViews
        ? (user.pageViews as Record<string, number>)
        : {},
  }
}
