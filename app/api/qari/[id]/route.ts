import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { removeAudio } from '@/lib/qari-storage'

export const runtime = 'nodejs'

type Action = 'like' | 'unlike' | 'play' | 'report'

/** POST /api/qari/[id] — like, unlike, count a play, or report. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const body = (await request.json()) as {
      action?: Action
      userId?: string
      reason?: string
    }
    const action = body.action
    const userId = body.userId?.trim()

    const recitation = await prisma.recitation.findUnique({ where: { id } })
    if (!recitation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'play') {
      const updated = await prisma.recitation.update({
        where: { id },
        data: { playCount: { increment: 1 } },
        select: { playCount: true },
      })
      return NextResponse.json({ playCount: updated.playCount })
    }

    if (!userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

    if (action === 'report') {
      await prisma.recitationReport.create({
        data: { recitationId: id, userId, reason: (body.reason || '').slice(0, 300) },
      })
      return NextResponse.json({ reported: true })
    }

    if (action === 'like' || action === 'unlike') {
      // The unique index can't be created on this connection, so guard here.
      const existing = await prisma.recitationLike.findFirst({
        where: { recitationId: id, userId },
        select: { id: true },
      })

      if (action === 'like' && !existing) {
        await prisma.recitationLike.create({ data: { recitationId: id, userId } })
        const updated = await prisma.recitation.update({
          where: { id },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        })
        return NextResponse.json({ liked: true, likeCount: updated.likeCount })
      }

      if (action === 'unlike' && existing) {
        await prisma.recitationLike.delete({ where: { id: existing.id } })
        const updated = await prisma.recitation.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        })
        return NextResponse.json({ liked: false, likeCount: Math.max(0, updated.likeCount) })
      }

      return NextResponse.json({
        liked: action === 'like',
        likeCount: recitation.likeCount,
      })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('[qari] action failed:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

/** DELETE /api/qari/[id]?userId= — only the owner may remove their recitation. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const userId = new URL(request.url).searchParams.get('userId')?.trim()

  try {
    const recitation = await prisma.recitation.findUnique({ where: { id } })
    if (!recitation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!userId || recitation.userId !== userId) {
      return NextResponse.json({ error: 'Not yours to delete.' }, { status: 403 })
    }

    await removeAudio(recitation.audioId)
    await prisma.recitationLike.deleteMany({ where: { recitationId: id } })
    await prisma.recitation.delete({ where: { id } })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[qari] delete failed:', err)
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
}
