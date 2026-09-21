import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'
import { notifyFollow } from '@/lib/notify'

export const runtime = 'nodejs'

interface FollowBody {
  userId?: string
  username?: string
  target?: string
}

async function state(target: string, viewerId: string | null) {
  const [followers, mine] = await Promise.all([
    prisma.qariFollow.count({ where: { followingUsername: target } }),
    viewerId
      ? prisma.qariFollow.findFirst({
          where: { followerId: viewerId, followingUsername: target },
          select: { id: true },
        })
      : null,
  ])
  return { followers, following: Boolean(mine) }
}

/** Reads and checks the caller: they may only follow as themselves. */
async function readCaller(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as FollowBody
  const userId = body.userId?.trim() ?? ''
  const username = body.username?.trim().toLowerCase() ?? ''
  const target = body.target?.trim().toLowerCase() ?? ''

  if (!userId || !username) {
    return { error: NextResponse.json({ error: 'Sign in to follow qaris.' }, { status: 401 }) }
  }
  if (!target) {
    return { error: NextResponse.json({ error: 'Who to follow is missing.' }, { status: 400 }) }
  }
  if (target === username) {
    return { error: NextResponse.json({ error: 'You cannot follow yourself.' }, { status: 400 }) }
  }
  if (!(await ownsUsername(username, userId))) {
    return { error: NextResponse.json({ error: 'Sign in again to follow qaris.' }, { status: 403 }) }
  }
  return { userId, username, target }
}

/** GET /api/qari/follow?target=username&viewerId= */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('target')?.trim().toLowerCase() ?? ''
  const viewerId = searchParams.get('viewerId')?.trim() || null
  if (!target) return NextResponse.json({ followers: 0, following: false })

  try {
    return NextResponse.json(await state(target, viewerId))
  } catch (err) {
    console.error('[qari] follow state failed:', err)
    return NextResponse.json({ followers: 0, following: false })
  }
}

/** POST /api/qari/follow — follow a qari. */
export async function POST(request: NextRequest) {
  try {
    const caller = await readCaller(request)
    if ('error' in caller) return caller.error

    // No unique index on this connection, so guard against a double tap here.
    const existing = await prisma.qariFollow.findFirst({
      where: { followerId: caller.userId, followingUsername: caller.target },
      select: { id: true },
    })
    if (!existing) {
      await prisma.qariFollow.create({
        data: {
          followerId: caller.userId,
          followerUsername: caller.username,
          followingUsername: caller.target,
        },
      })
      await notifyFollow(caller.target, caller.userId)
    }
    return NextResponse.json(await state(caller.target, caller.userId))
  } catch (err) {
    console.error('[qari] follow failed:', err)
    return NextResponse.json({ error: 'Could not follow right now.' }, { status: 500 })
  }
}

/** DELETE /api/qari/follow — unfollow. */
export async function DELETE(request: NextRequest) {
  try {
    const caller = await readCaller(request)
    if ('error' in caller) return caller.error

    await prisma.qariFollow.deleteMany({
      where: { followerId: caller.userId, followingUsername: caller.target },
    })
    return NextResponse.json(await state(caller.target, caller.userId))
  } catch (err) {
    console.error('[qari] unfollow failed:', err)
    return NextResponse.json({ error: 'Could not unfollow right now.' }, { status: 500 })
  }
}
