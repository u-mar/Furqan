import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isGuestId } from '@/lib/guest-id'

export const runtime = 'nodejs'

/**
 * POST /api/qari/likes/merge { guestId, userId }
 *
 * Someone liked recitations before they had an account, then made one or
 * signed in: their hearts move from the phone's guest id to the account. A
 * recitation the account had already liked keeps one like, not two.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { guestId?: string; userId?: string }
    const guestId = body.guestId?.trim()
    const userId = body.userId?.trim()
    if (!isGuestId(guestId) || !userId || userId.startsWith('guest_')) {
      return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
    }

    // Only into an account that exists (or a phone-only one, which has no row).
    if (!userId.startsWith('local_')) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } }).catch(() => null)
      if (!user) return NextResponse.json({ error: 'No such account.' }, { status: 404 })
    }

    const guestLikes = await prisma.recitationLike.findMany({
      where: { userId: guestId },
      select: { id: true, recitationId: true },
    })
    if (guestLikes.length === 0) return NextResponse.json({ moved: 0 })

    const already = new Set(
      (
        await prisma.recitationLike.findMany({
          where: { userId, recitationId: { in: guestLikes.map((l) => l.recitationId) } },
          select: { recitationId: true },
        })
      ).map((l) => l.recitationId)
    )

    let moved = 0
    for (const like of guestLikes) {
      if (already.has(like.recitationId)) {
        // Liked from both: one like stays, so the count drops by the extra one.
        await prisma.recitationLike.delete({ where: { id: like.id } })
        await prisma.recitation
          .update({ where: { id: like.recitationId }, data: { likeCount: { decrement: 1 } } })
          .catch(() => null)
      } else {
        await prisma.recitationLike.update({ where: { id: like.id }, data: { userId } })
        moved += 1
      }
    }
    return NextResponse.json({ moved })
  } catch (err) {
    console.error('[qari] merging guest likes failed:', err)
    return NextResponse.json({ error: 'Could not move likes.' }, { status: 500 })
  }
}
