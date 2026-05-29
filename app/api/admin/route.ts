import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  isAdminRequestAuthenticated,
  unauthorizedAdminResponse,
} from '@/lib/admin-auth-server'
import { mapAdminUser } from '@/lib/admin-user-map'

const ADMIN_CONFIG_KEY = 'global'

export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) {
    return unauthorizedAdminResponse()
  }

  const [config, feedback, users, popups] = await Promise.all([
    prisma.adminConfig.findUnique({ where: { key: ADMIN_CONFIG_KEY } }),
    prisma.feedbackMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.userUsage.findMany({ orderBy: { lastSeenAt: 'desc' }, take: 300 }),
    prisma.popupMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
  ])

  const now = Date.now()
  const mappedUsers = users.map((u) => mapAdminUser(u, now))

  return NextResponse.json({
    dailyVerse: {
      verseKey: config?.dailyVerseKey ?? '2:152',
      surahName: config?.dailyVerseSurah ?? 'Al-Baqarah',
      label: config?.dailyVerseSurah ?? 'Al-Baqarah',
    },
    feedback: feedback.map((item) => ({
      id: item.id,
      userId: item.userId,
      userName: item.userName,
      message: item.message,
      contact: item.contact,
      createdAt: item.createdAt.getTime(),
    })),
    users: mappedUsers,
    stats: {
      totalUsers: mappedUsers.length,
      registered: mappedUsers.filter((u) => u.userKind === 'registered').length,
      guests: mappedUsers.filter((u) => u.userKind === 'guest').length,
      onlineNow: mappedUsers.filter((u) => u.isOnline).length,
    },
    popups: popups.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      targetUserId: p.targetUserId,
      createdAt: p.createdAt.getTime(),
      dismissedBy: p.dismissedBy,
      shownTo: [],
    })),
  })
}
