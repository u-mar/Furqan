import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSheikhId } from '@/lib/sheikhs'

export const runtime = 'nodejs'

/** Everything here is built from public recordings only. */
const PUBLIC = { hidden: false, isPrivate: false }

/** How far back the popular tags and sheikhs look. Plenty for a feed this size. */
const SAMPLE = 800

/**
 * The sections change slowly and cost two large reads, so a minute-old answer is
 * reused instead of asking the database again for every visitor.
 */
const REUSE_MS = 60_000
let reusable: { at: number; body: unknown } | null = null

/**
 * GET /api/qari/discover — the sections at the top of Qari home.
 * GET /api/qari/discover?sheikh=id — how many imitations one sheikh has.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sheikh = searchParams.get('sheikh')?.trim() ?? ''

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

    if (reusable && Date.now() - reusable.at < REUSE_MS) return NextResponse.json(reusable.body)

    const [recent, loved] = await Promise.all([
      prisma.recitation.findMany({
        where: PUBLIC,
        select: { hashtags: true, imitating: true },
        orderBy: { createdAt: 'desc' },
        take: SAMPLE,
      }),
      // Newest first, so the first name met for a handle is the current one.
      prisma.recitation.findMany({
        where: { ...PUBLIC, likeCount: { gt: 0 } },
        select: { userUsername: true, userName: true, likeCount: true },
        orderBy: { createdAt: 'desc' },
        take: 3000,
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

    // The qaris whose recitations have been loved most, all hearts added up.
    const qaris = new Map<string, { username: string; name: string; likes: number }>()
    for (const row of loved) {
      const key = row.userUsername.toLowerCase()
      const entry = qaris.get(key)
      if (entry) entry.likes += row.likeCount
      else qaris.set(key, { username: row.userUsername, name: row.userName || row.userUsername, likes: row.likeCount })
    }

    const body = {
      tags: [...tagCounts].map(([tag, count]) => ({ tag, count })).sort(byCount).slice(0, 12),
      sheikhs: [...sheikhCounts].map(([id, count]) => ({ id, count })).sort(byCount).slice(0, 8),
      lovedQaris: [...qaris.values()].sort((a, b) => b.likes - a.likes || a.name.localeCompare(b.name)).slice(0, 15),
    }
    reusable = { at: Date.now(), body }
    return NextResponse.json(body)
  } catch (err) {
    console.error('[qari] discover failed:', err)
    return NextResponse.json({ error: 'Could not load Qari.' }, { status: 500 })
  }
}
