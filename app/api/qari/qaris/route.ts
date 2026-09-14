import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/qari/qaris?viewerId=&q=&following=1
 *
 * Everyone who has published, with how many public recitations they have and
 * whether the viewer follows them. Built from the recordings themselves,
 * because local-only accounts never appear in the User table.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const viewerId = searchParams.get('viewerId')?.trim() || null
  const query = searchParams.get('q')?.trim().toLowerCase().slice(0, 40) ?? ''
  const onlyFollowing = searchParams.get('following') === '1'

  try {
    const [rows, follows] = await Promise.all([
      prisma.recitation.findMany({
        where: { hidden: false, isPrivate: false },
        select: { userUsername: true, userName: true },
        orderBy: { createdAt: 'desc' },
        take: 3000,
      }),
      viewerId
        ? prisma.qariFollow.findMany({
            where: { followerId: viewerId },
            select: { followingUsername: true },
          })
        : Promise.resolve([] as { followingUsername: string }[]),
    ])

    const followed = new Set(follows.map((f) => f.followingUsername))

    // Newest first, so the first name seen for a handle is the current one.
    const qaris = new Map<string, { username: string; name: string; recitations: number }>()
    for (const row of rows) {
      const key = row.userUsername.toLowerCase()
      const entry = qaris.get(key)
      if (entry) entry.recitations += 1
      else qaris.set(key, { username: row.userUsername, name: row.userName || row.userUsername, recitations: 1 })
    }

    // People you follow who have nothing public yet still belong in your list.
    for (const username of followed) {
      if (!qaris.has(username)) {
        qaris.set(username, { username, name: username, recitations: 0 })
      }
    }
    const missingNames = [...qaris.values()].filter((q) => q.recitations === 0).map((q) => q.username)
    if (missingNames.length > 0) {
      const users = await prisma.user.findMany({
        where: { username: { in: missingNames } },
        select: { username: true, name: true },
      })
      for (const user of users) {
        const entry = qaris.get(user.username.toLowerCase())
        if (entry) entry.name = user.name || user.username
      }
    }

    const items = [...qaris.values()]
      .map((q) => ({ ...q, following: followed.has(q.username.toLowerCase()) }))
      .filter((q) => (onlyFollowing ? q.following : true))
      .filter((q) => !query || q.name.toLowerCase().includes(query) || q.username.toLowerCase().includes(query))
      .sort((a, b) => b.recitations - a.recitations || a.name.localeCompare(b.name))
      .slice(0, 100)

    return NextResponse.json({ items })
  } catch (err) {
    console.error('[qari] qaris failed:', err)
    return NextResponse.json({ error: 'Could not load qaris.' }, { status: 500 })
  }
}
