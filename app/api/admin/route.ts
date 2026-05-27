import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_CONFIG_KEY = 'global'

export async function GET() {
  const [config, feedback, users] = await Promise.all([
    prisma.adminConfig.findUnique({ where: { key: ADMIN_CONFIG_KEY } }),
    prisma.feedbackMessage.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.userUsage.findMany({ orderBy: { lastSeenAt: 'desc' }, take: 200 }),
  ])

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
    users: users.map((user) => ({
      userId: user.userId,
      userName: user.userName,
      createdAt: user.createdAt.getTime(),
      lastSeenAt: user.lastSeenAt.getTime(),
      totalVisits: user.totalVisits,
      lastPath: user.lastPath,
      pageViews: typeof user.pageViews === 'object' && user.pageViews ? user.pageViews : {},
    })),
  })
}
