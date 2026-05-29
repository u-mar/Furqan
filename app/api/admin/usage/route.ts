import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveUserKind } from '@/lib/presence'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    userId?: string
    userName?: string
    pathname?: string
    countSession?: boolean
    /** false when tab hidden / app backgrounded — records offline time. */
    isActive?: boolean
  }

  const userId = body.userId?.trim() ?? ''
  const userName = body.userName?.trim() ?? ''
  const pathname = body.pathname?.trim() ?? '/'
  const countSession = body.countSession === true
  const isActive = body.isActive !== false
  const now = new Date()

  if (!userId || !userName) {
    return NextResponse.json({ error: 'Missing usage identity.' }, { status: 400 })
  }

  const userKind = resolveUserKind(userId)
  const existing = await prisma.userUsage.findUnique({ where: { userId } })
  const pageViews =
    existing && typeof existing.pageViews === 'object' && existing.pageViews
      ? (existing.pageViews as Record<string, number>)
      : {}

  if (!isActive) {
    const upserted = await prisma.userUsage.upsert({
      where: { userId },
      update: {
        userName,
        userKind,
        lastOfflineAt: now,
      },
      create: {
        userId,
        userName,
        userKind,
        lastPath: pathname,
        lastOfflineAt: now,
        totalVisits: 0,
        pageViews: {},
      },
    })
    return NextResponse.json({
      ok: true,
      lastSeenAt: upserted.lastSeenAt.getTime(),
      lastOfflineAt: upserted.lastOfflineAt?.getTime() ?? now.getTime(),
    })
  }

  const currentCount = typeof pageViews[pathname] === 'number' ? pageViews[pathname] : 0
  const nextVisits = (existing?.totalVisits ?? 0) + (countSession ? 1 : 0)

  const upserted = await prisma.userUsage.upsert({
    where: { userId },
    update: {
      userName,
      userKind,
      lastSeenAt: now,
      lastPath: pathname,
      totalVisits: nextVisits,
      pageViews: { ...pageViews, [pathname]: currentCount + 1 },
    },
    create: {
      userId,
      userName,
      userKind,
      lastPath: pathname,
      totalVisits: countSession ? 1 : 0,
      pageViews: { [pathname]: 1 },
    },
  })

  return NextResponse.json({
    ok: true,
    lastSeenAt: upserted.lastSeenAt.getTime(),
    lastOfflineAt: upserted.lastOfflineAt?.getTime() ?? null,
  })
}
