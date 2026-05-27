import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    userId?: string
    userName?: string
    pathname?: string
  }

  const userId = body.userId?.trim() ?? ''
  const userName = body.userName?.trim() ?? ''
  const pathname = body.pathname?.trim() ?? '/'

  if (!userId || !userName) {
    return NextResponse.json({ error: 'Missing usage identity.' }, { status: 400 })
  }

  const existing = await prisma.userUsage.findUnique({ where: { userId } })
  const pageViews =
    existing && typeof existing.pageViews === 'object' && existing.pageViews
      ? (existing.pageViews as Record<string, number>)
      : {}
  const currentCount = typeof pageViews[pathname] === 'number' ? pageViews[pathname] : 0

  const upserted = await prisma.userUsage.upsert({
    where: { userId },
    update: {
      userName,
      lastSeenAt: new Date(),
      lastPath: pathname,
      totalVisits: (existing?.totalVisits ?? 0) + 1,
      pageViews: { ...pageViews, [pathname]: currentCount + 1 },
    },
    create: {
      userId,
      userName,
      lastPath: pathname,
      totalVisits: 1,
      pageViews: { [pathname]: 1 },
    },
  })

  return NextResponse.json({ ok: true, lastSeenAt: upserted.lastSeenAt.getTime() })
}
