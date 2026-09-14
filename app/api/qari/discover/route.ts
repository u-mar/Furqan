import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { likedIdsFor, toClientRecitation } from '@/lib/qari-serialize'
import { isSheikhId } from '@/lib/sheikhs'

export const runtime = 'nodejs'

/** Everything here is built from public recordings only. */
const PUBLIC = { hidden: false, isPrivate: false }

/** How far back the popular tags and sheikhs look. Plenty for a feed this size. */
const SAMPLE = 800

/**
 * GET /api/qari/discover?viewerId= — the sections at the top of Qari home.
 * GET /api/qari/discover?sheikh=id — how many imitations one sheikh has.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sheikh = searchParams.get('sheikh')?.trim() ?? ''
  const viewerId = searchParams.get('viewerId')?.trim() || null

  try {
    if (sheikh) {
      if (!isSheikhId(sheikh)) return NextResponse.json({ count: 0, people: 0 })
      const rows = await prisma.recitation.findMany({
        where: { ...PUBLIC, imitating: sheikh },
        select: { userUsername: true },
      })
      return NextResponse.json({
        count: rows.length,
        people: new Set(rows.map((r) => r.userUsername)).size,
      })
    }

    const [recent, loved] = await Promise.all([
      prisma.recitation.findMany({
        where: PUBLIC,
        select: { hashtags: true, imitating: true },
        orderBy: { createdAt: 'desc' },
        take: SAMPLE,
      }),
      prisma.recitation.findMany({
        where: { ...PUBLIC, likeCount: { gt: 0 } },
        orderBy: [{ likeCount: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    ])

    const tagCounts = new Map<string, number>()
    const sheikhCounts = new Map<string, number>()
    for (const row of recent) {
      for (const tag of row.hashtags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
      if (row.imitating && isSheikhId(row.imitating)) {
        sheikhCounts.set(row.imitating, (sheikhCounts.get(row.imitating) ?? 0) + 1)
      }
    }

    const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count

    const likedIds = await likedIdsFor(viewerId, loved.map((r) => r.id))

    return NextResponse.json({
      tags: [...tagCounts].map(([tag, count]) => ({ tag, count })).sort(byCount).slice(0, 12),
      sheikhs: [...sheikhCounts].map(([id, count]) => ({ id, count })).sort(byCount).slice(0, 8),
      mostLoved: loved.map((r) => toClientRecitation(r, likedIds.has(r.id))),
    })
  } catch (err) {
    console.error('[qari] discover failed:', err)
    return NextResponse.json({ error: 'Could not load Qari.' }, { status: 500 })
  }
}
