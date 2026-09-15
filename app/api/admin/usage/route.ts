import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveUserKind } from '@/lib/presence'

/**
 * Two reports for the same visitor often arrive together — leaving one page
 * sends "inactive" as the next page sends "active" — and on MongoDB the second
 * write then fails with a write conflict (P2034), or a unique clash (P2002)
 * when both try to create the visitor's first record. Rather than answer 500,
 * the whole read-and-write is tried again, so it works from the latest record.
 */
async function withWriteRetry<T>(write: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await write()
    } catch (err) {
      const retryable =
        err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2034' || err.code === 'P2002')
      if (!retryable || attempt >= attempts) throw err
      await new Promise((resolve) => setTimeout(resolve, 30 * attempt + Math.random() * 60))
    }
  }
}

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

  if (!userId || !userName) {
    return NextResponse.json({ error: 'Missing usage identity.' }, { status: 400 })
  }

  const userKind = resolveUserKind(userId)

  const result = await withWriteRetry(async () => {
    const now = new Date()
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
      return {
        lastSeenAt: upserted.lastSeenAt.getTime(),
        lastOfflineAt: upserted.lastOfflineAt?.getTime() ?? now.getTime(),
      }
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
    return {
      lastSeenAt: upserted.lastSeenAt.getTime(),
      lastOfflineAt: upserted.lastOfflineAt?.getTime() ?? null,
    }
  })

  return NextResponse.json({ ok: true, ...result })
}
