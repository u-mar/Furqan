import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

const PAGE = 40

/** Only the person a notification is for may read it. */
async function caller(username: string, userId: string) {
  const name = username.trim().toLowerCase()
  const id = userId.trim()
  if (!name || !id) return null
  return (await ownsUsername(name, id)) ? name : null
}

/** GET /api/qari/notifications?username=&userId= — the latest, and how many are unread. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = await caller(searchParams.get('username') ?? '', searchParams.get('userId') ?? '')
  if (!username) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  try {
    const countOnly = searchParams.get('count') === '1'
    const unread = await prisma.notification.count({ where: { recipientUsername: username, readAt: null } })
    if (countOnly) return NextResponse.json({ unread })

    const rows = await prisma.notification.findMany({
      where: { recipientUsername: username },
      orderBy: { createdAt: 'desc' },
      take: PAGE,
    })
    return NextResponse.json({
      unread,
      items: rows.map((n) => ({
        id: n.id,
        type: n.type,
        actorUsername: n.actorUsername,
        actorName: n.actorName,
        recitationId: n.recitationId,
        recitationTitle: n.recitationTitle,
        createdAt: n.createdAt.toISOString(),
        read: Boolean(n.readAt),
      })),
    })
  } catch (err) {
    console.error('[notifications] list failed:', err)
    return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 })
  }
}

/** POST /api/qari/notifications — mark everything read. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { username?: string; userId?: string }
  const username = await caller(body.username ?? '', body.userId ?? '')
  if (!username) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  try {
    await prisma.notification.updateMany({
      where: { recipientUsername: username, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ unread: 0 })
  } catch (err) {
    console.error('[notifications] mark read failed:', err)
    return NextResponse.json({ error: 'Could not update.' }, { status: 500 })
  }
}
