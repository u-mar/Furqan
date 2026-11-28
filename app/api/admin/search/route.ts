import { NextResponse } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/admin/search?q= — the admin's search box: people (by name or @username), Qari
 * recitations (by title or reciter) and Listen qaris, a few of each.
 */
export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ people: [], recitations: [], qaris: [] })
  const contains = { contains: q, mode: 'insensitive' as const }

  const [accounts, visitors, recitations, qaris] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ name: contains }, { username: contains }, { email: contains }] },
      select: { id: true, name: true, username: true, verified: true },
      take: 6,
    }),
    prisma.userUsage.findMany({
      where: { userName: contains },
      select: { userId: true, userName: true, userKind: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 6,
    }),
    prisma.recitation.findMany({
      where: { OR: [{ title: contains }, { userName: contains }, { userUsername: contains }] },
      select: { id: true, title: true, userName: true, userUsername: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.listenReciter.findMany({
      where: { OR: [{ name: contains }, { city: contains }] },
      select: { id: true, name: true, country: true, published: true },
      take: 5,
    }),
  ])

  return NextResponse.json({
    people: [
      ...accounts.map((a) => ({ id: a.id, name: a.name, detail: `@${a.username}`, verified: a.verified === true, kind: 'account' as const })),
      ...visitors
        .filter((v) => !accounts.some((a) => a.id === v.userId))
        .map((v) => ({ id: v.userId, name: v.userName, detail: v.userKind === 'guest' ? 'Guest' : 'Account', verified: false, kind: 'visitor' as const })),
    ].slice(0, 8),
    recitations: recitations.map((r) => ({
      id: r.id,
      title: r.title || 'Untitled recitation',
      detail: `${r.userName} · @${r.userUsername}`,
      createdAt: r.createdAt.getTime(),
    })),
    qaris: qaris.map((r) => ({ id: r.id, name: r.name, detail: `${r.country}${r.published ? '' : ' · hidden'}` })),
  })
}
