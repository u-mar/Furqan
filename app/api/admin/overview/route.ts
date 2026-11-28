import { NextResponse } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { mapAdminUser } from '@/lib/admin-user-map'
import { prisma } from '@/lib/prisma'
import { isUserOnline } from '@/lib/presence'

export const runtime = 'nodejs'

const DAY = 24 * 60 * 60 * 1000

/** The screen a path belongs to, for "most used screens". */
function screenOf(path: string): string {
  const first = path.split('?')[0].split('/')[1] ?? ''
  const names: Record<string, string> = {
    '': 'Home',
    read: 'Read',
    listen: 'Listen',
    qari: 'Qari',
    prayer: 'Prayer',
    halaqa: 'Halaqa',
    settings: 'Settings',
    hifdh: 'Hifdh',
  }
  return names[first] ?? 'Other'
}

const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10)

/**
 * GET /api/admin/overview — the admin's front page: who is here now, today and this week, the
 * last 30 days of new people, Qari and Listen at a glance, what is waiting for the admin, and the
 * screens used most.
 */
export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()

  const now = Date.now()
  const today = utcDay(now)
  const yesterday = utcDay(now - DAY)
  const startOfToday = new Date(`${today}T00:00:00.000Z`)

  const [
    people,
    accounts,
    recentPeople,
    activeTodayRows,
    activeYesterdayRows,
    active7,
    active30,
    seenToday,
    postsThisWeek,
    postsLastWeek,
    halaqas,
    listenQaris,
    reportedIds,
    verificationRequests,
    surahsToReview,
    feedbackWeek,
    recentlyActive,
    usage30,
  ] = await Promise.all([
    prisma.userUsage.count(),
    prisma.user.count(),
    prisma.userUsage.findMany({ where: { createdAt: { gte: new Date(now - 30 * DAY) } }, select: { createdAt: true, userKind: true } }),
    prisma.activeDay.count({ where: { day: today } }),
    prisma.activeDay.count({ where: { day: yesterday } }),
    prisma.userUsage.count({ where: { lastSeenAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.userUsage.count({ where: { lastSeenAt: { gte: new Date(now - 30 * DAY) } } }),
    prisma.userUsage.count({ where: { lastSeenAt: { gte: startOfToday } } }),
    prisma.recitation.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.recitation.count({ where: { createdAt: { gte: new Date(now - 14 * DAY), lt: new Date(now - 7 * DAY) } } }),
    prisma.halaqa.count(),
    prisma.listenReciter.count({ where: { published: true } }),
    prisma.recitationReport.findMany({ select: { recitationId: true }, distinct: ['recitationId'] }),
    prisma.user.count({ where: { verifyRequestedAt: { not: null }, NOT: { verified: true } } }),
    prisma.listenSurah.count({ where: { status: 'checked' } }),
    prisma.feedbackMessage.count({ where: { createdAt: { gte: new Date(now - 7 * DAY) } } }),
    prisma.userUsage.findMany({ orderBy: { lastSeenAt: 'desc' }, take: 8 }),
    prisma.userUsage.findMany({ where: { lastSeenAt: { gte: new Date(now - 30 * DAY) } }, select: { pageViews: true }, take: 5000 }),
  ])

  // New people per day, the last 30 days (oldest first).
  const perDay = new Map<string, number>()
  for (let i = 29; i >= 0; i--) perDay.set(utcDay(now - i * DAY), 0)
  for (const p of recentPeople) {
    const day = utcDay(p.createdAt.getTime())
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  const newPerDay = [...perDay.entries()].map(([day, count]) => ({ day, count }))
  const newThisWeek = newPerDay.slice(-7).reduce((sum, d) => sum + d.count, 0)
  const newLastWeek = newPerDay.slice(-14, -7).reduce((sum, d) => sum + d.count, 0)

  const screens = new Map<string, number>()
  for (const u of usage30) {
    const views = (u.pageViews ?? {}) as Record<string, number>
    for (const [path, count] of Object.entries(views)) {
      if (typeof count !== 'number' || path.startsWith('/admin')) continue
      const screen = screenOf(path)
      screens.set(screen, (screens.get(screen) ?? 0) + count)
    }
  }
  const totalViews = [...screens.values()].reduce((a, b) => a + b, 0) || 1
  const topScreens = [...screens.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([screen, views]) => ({ screen, views, share: views / totalViews }))

  const onlineNow = recentlyActive.filter((u) => isUserOnline(u.lastSeenAt.getTime(), now)).length
  const online = onlineNow < recentlyActive.length ? onlineNow : await prisma.userUsage.count({ where: { lastSeenAt: { gte: new Date(now - 90 * 1000) } } })

  return NextResponse.json(
    {
      generatedAt: now,
      people,
      accounts,
      online,
      // Until the daily record has a day behind it, "today" is whoever has been seen since midnight (UTC).
      activeToday: Math.max(activeTodayRows, seenToday),
      activeYesterday: activeYesterdayRows || null,
      active7,
      active30,
      newThisWeek,
      newLastWeek,
      newPerDay,
      qari: { postsThisWeek, postsLastWeek },
      halaqas,
      listenQaris,
      attention: {
        reports: reportedIds.length,
        verification: verificationRequests,
        surahsToReview,
        feedbackThisWeek: feedbackWeek,
      },
      topScreens,
      recentlyActive: recentlyActive.map((u) => mapAdminUser(u, now)),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
