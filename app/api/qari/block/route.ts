import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

interface BlockBody {
  userId?: string
  username?: string
  target?: string
}

/** The caller, checked: they may only block as themselves, and not themselves. */
async function readCaller(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as BlockBody
  const userId = body.userId?.trim() ?? ''
  const username = body.username?.trim().toLowerCase() ?? ''
  const target = body.target?.trim().toLowerCase() ?? ''

  if (!userId || !username) return { error: NextResponse.json({ error: 'Sign in to block someone.' }, { status: 401 }) }
  if (!target) return { error: NextResponse.json({ error: 'Who to block is missing.' }, { status: 400 }) }
  if (target === username) return { error: NextResponse.json({ error: 'You cannot block yourself.' }, { status: 400 }) }
  if (!(await ownsUsername(username, userId))) {
    return { error: NextResponse.json({ error: 'Sign in again to do that.' }, { status: 403 }) }
  }
  return { userId, username, target }
}

/** GET /api/qari/block?username=&userId= — the usernames this person has blocked. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.trim().toLowerCase() ?? ''
  const userId = searchParams.get('userId')?.trim() ?? ''
  if (!username || !userId || !(await ownsUsername(username, userId))) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }
  try {
    const rows = await prisma.qariBlock.findMany({
      where: { blockerUsername: username },
      orderBy: { createdAt: 'desc' },
      select: { blockedUsername: true },
    })
    return NextResponse.json({ blocked: rows.map((r) => r.blockedUsername) })
  } catch (err) {
    console.error('[qari] blocks failed:', err)
    return NextResponse.json({ error: 'Could not load blocked accounts.' }, { status: 500 })
  }
}

/** POST /api/qari/block — block someone: their posts and notifications go, and follows both ways end. */
export async function POST(request: NextRequest) {
  try {
    const caller = await readCaller(request)
    if ('error' in caller) return caller.error

    const existing = await prisma.qariBlock.findFirst({
      where: { blockerUsername: caller.username, blockedUsername: caller.target },
      select: { id: true },
    })
    if (!existing) {
      await prisma.qariBlock.create({
        data: { blockerId: caller.userId, blockerUsername: caller.username, blockedUsername: caller.target },
      })
    }
    await prisma.qariFollow.deleteMany({
      where: {
        OR: [
          { followerUsername: caller.username, followingUsername: caller.target },
          { followerId: caller.userId, followingUsername: caller.target },
          { followerUsername: caller.target, followingUsername: caller.username },
        ],
      },
    })
    await prisma.notification.deleteMany({
      where: { recipientUsername: caller.username, actorUsername: caller.target },
    })
    return NextResponse.json({ blocked: true })
  } catch (err) {
    console.error('[qari] block failed:', err)
    return NextResponse.json({ error: 'Could not block right now.' }, { status: 500 })
  }
}

/** DELETE /api/qari/block — unblock. Follows that ended stay ended. */
export async function DELETE(request: NextRequest) {
  try {
    const caller = await readCaller(request)
    if ('error' in caller) return caller.error
    await prisma.qariBlock.deleteMany({ where: { blockerUsername: caller.username, blockedUsername: caller.target } })
    return NextResponse.json({ blocked: false })
  } catch (err) {
    console.error('[qari] unblock failed:', err)
    return NextResponse.json({ error: 'Could not unblock right now.' }, { status: 500 })
  }
}
