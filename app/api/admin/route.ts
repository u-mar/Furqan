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

  const [config, feedback, users, popups, reports] = await Promise.all([
    prisma.adminConfig.findUnique({ where: { key: ADMIN_CONFIG_KEY } }),
    prisma.feedbackMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.userUsage.findMany({ orderBy: { lastSeenAt: 'desc' }, take: 300 }),
    prisma.popupMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.recitationReport.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }),
  ])

  const now = Date.now()
  const mappedUsers = users.map((u) => mapAdminUser(u, now))

  // Each report only carries the recitation's id — fetch the recitations
  // themselves in one pass, so a report whose recording was already removed
  // is dropped rather than shown with nothing to act on.
  const recitationIds = [...new Set(reports.map((r) => r.recitationId))]
  const recitations = recitationIds.length
    ? await prisma.recitation.findMany({
        where: { id: { in: recitationIds } },
        select: { id: true, title: true, userName: true, userUsername: true, isPrivate: true, createdAt: true },
      })
    : []
  const recitationById = new Map(recitations.map((r) => [r.id, r]))
  const mappedReports = reports
    .filter((r) => recitationById.has(r.recitationId))
    .map((r) => {
      const recitation = recitationById.get(r.recitationId)!
      return {
        id: r.id,
        recitationId: r.recitationId,
        recitationTitle: recitation.title,
        recitationOwnerName: recitation.userName,
        recitationOwnerUsername: recitation.userUsername,
        recitationIsPrivate: recitation.isPrivate ?? false,
        recitationCreatedAt: recitation.createdAt.getTime(),
        reason: r.reason,
        reporterId: r.userId,
        createdAt: r.createdAt.getTime(),
      }
    })

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
    reports: mappedReports,
  })
}
