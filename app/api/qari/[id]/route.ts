import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-auth-server'
import { NextRequest, NextResponse, after } from 'next/server'
import type { Recitation as RecitationRecord } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { removeAudio, removeImage } from '@/lib/qari-storage'
import { LIKE_MILESTONES, notifyLike, notifyMilestone, PLAY_MILESTONES } from '@/lib/notify'
import { isGuestId } from '@/lib/guest-id'
import { isVideoBackgroundId } from '@/lib/qari-backgrounds'
import { cloudVideoFor, dropCloudVideo, requestCloudVideo } from '@/lib/qari-cloud-video'
import { toClientRecitation } from '@/lib/qari-serialize'

export const runtime = 'nodejs'

type Action = 'like' | 'unlike' | 'play' | 'report' | 'setPrivacy' | 'setBackground' | 'setTitle'

/** Likes from one guest id per minute. Kept per server instance, which is enough to stop a script. */
const GUEST_LIKES_PER_MINUTE = 30
const guestTaps = new Map<string, number[]>()

function guestMayLike(guestId: string): boolean {
  const now = Date.now()
  const recent = (guestTaps.get(guestId) ?? []).filter((t) => now - t < 60_000)
  if (recent.length >= GUEST_LIKES_PER_MINUTE) return false
  recent.push(now)
  guestTaps.set(guestId, recent)
  // Forget quiet guests now and then so the map stays small.
  if (guestTaps.size > 5000) {
    for (const [id, taps] of guestTaps) if (taps.every((t) => now - t >= 60_000)) guestTaps.delete(id)
  }
  return true
}

/** GET /api/qari/[id] — one public recitation, as the feed lists it (for the video made in the cloud). */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const recitation = await prisma.recitation.findFirst({ where: { id, hidden: false, isPrivate: false } }).catch(() => null)
  if (!recitation) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  return NextResponse.json({ recitation: toClientRecitation(recitation, false) })
}

/** POST /api/qari/[id] — like, unlike, count a play, report, or (the reciter) change who hears it, what it is shown on, or its title. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const body = (await request.json()) as {
      action?: Action
      userId?: string
      reason?: string
      isPrivate?: boolean
      background?: string
      title?: string
    }
    const action = body.action
    const userId = body.userId?.trim()

    const recitation = await prisma.recitation.findUnique({ where: { id } })
    if (!recitation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (action === 'play') {
      // Listening back to your own recitation is not an audience of one.
      if (userId && userId === recitation.userId) {
        return NextResponse.json({ playCount: recitation.playCount, counted: false })
      }
      const updated = await prisma.recitation.update({
        where: { id },
        data: { playCount: { increment: 1 } },
        select: { playCount: true },
      })
      if (!recitation.isPrivate && PLAY_MILESTONES.includes(updated.playCount)) {
        await notifyMilestone(recitation, 'plays', updated.playCount)
      }
      return NextResponse.json({ playCount: updated.playCount, counted: true })
    }

    // The admin session: may rename any recitation, change what it is shown on, or who can hear it.
    const admin = verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)
    const adminMay = admin && (action === 'setBackground' || action === 'setTitle' || action === 'setPrivacy')

    if (!userId && !adminMay) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

    if (action === 'setPrivacy') {
      // The reciter decides who can hear their own recording, and the admin may too.
      if (recitation.userId !== userId && !adminMay) {
        return NextResponse.json({ error: 'Not yours to change.' }, { status: 403 })
      }
      const updated = await prisma.recitation.update({
        where: { id },
        data: { isPrivate: Boolean(body.isPrivate) },
        select: { isPrivate: true },
      })
      // Made public without its English video yet: make it now.
      if (!updated.isPrivate && !recitation.videoKey && recitation.kind !== 'ayah') after(() => requestCloudVideo(id))
      return NextResponse.json({ isPrivate: updated.isPrivate })
    }

    if (action === 'setBackground') {
      // Only the reciter (or the admin) picks what their recitation is shown on. A picture
      // made on the Read screen is its own background.
      if (recitation.userId !== userId && !adminMay) {
        return NextResponse.json({ error: 'Not yours to change.' }, { status: 403 })
      }
      if (recitation.kind === 'ayah' || !isVideoBackgroundId(body.background)) {
        return NextResponse.json({ error: 'Unknown background.' }, { status: 400 })
      }
      const updated = await prisma.recitation.update({
        where: { id },
        data: { background: body.background },
        select: { background: true },
      })
      await videoAgainIfChanged(recitation, { ...recitation, background: updated.background })
      return NextResponse.json({ background: updated.background })
    }

    if (action === 'setTitle') {
      // Only the reciter (or the admin) renames it; as long as a title may be when posting.
      if (recitation.userId !== userId && !adminMay) {
        return NextResponse.json({ error: 'Not yours to change.' }, { status: 403 })
      }
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : ''
      if (!title) return NextResponse.json({ error: 'Give your recitation a title.' }, { status: 400 })
      const updated = await prisma.recitation.update({ where: { id }, data: { title }, select: { title: true } })
      await videoAgainIfChanged(recitation, { ...recitation, title: updated.title })
      return NextResponse.json({ title: updated.title })
    }

    // Reporting and liking are always someone's own.
    if (!userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

    if (action === 'report') {
      await prisma.recitationReport.create({
        data: { recitationId: id, userId, reason: (body.reason || '').slice(0, 300) },
      })
      return NextResponse.json({ reported: true })
    }

    if (action === 'like' || action === 'unlike') {
      // Liking needs no account: a phone's guest id counts once per recitation,
      // like an account. A guest may not tap faster than a person would.
      if (isGuestId(userId) && !guestMayLike(userId)) {
        return NextResponse.json({ error: 'Too many taps. Wait a moment.' }, { status: 429 })
      }
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
        // Tell the reciter. A private recording can only be liked by its owner, so it is skipped.
        if (!recitation.isPrivate) {
          await notifyLike(recitation, userId)
          if (LIKE_MILESTONES.includes(updated.likeCount)) await notifyMilestone(recitation, 'likes', updated.likeCount)
        }
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

/** DELETE /api/qari/[id]?userId= — only the owner, or the admin, may remove a recitation. */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const userId = new URL(request.url).searchParams.get('userId')?.trim()
  const admin = verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)

  try {
    const recitation = await prisma.recitation.findUnique({ where: { id } })
    if (!recitation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!admin && (!userId || recitation.userId !== userId)) {
      return NextResponse.json({ error: 'Not yours to delete.' }, { status: 403 })
    }

    if (recitation.audioId) await removeAudio(recitation.audioId)
    if (recitation.imageId) await removeImage(recitation.imageId)
    await dropCloudVideo(recitation, true)
    await prisma.recitationLike.deleteMany({ where: { recitationId: id } })
    await prisma.recitation.delete({ where: { id } })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[qari] delete failed:', err)
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
}

/**
 * When what a recitation's video shows has changed (its background, or the title it shows when it has
 * no ayah marks): the old video goes and, once this answer is sent, a new one is made.
 */
async function videoAgainIfChanged(before: RecitationRecord, after_: RecitationRecord): Promise<void> {
  if (before.kind === 'ayah' || cloudVideoFor(before) === cloudVideoFor(after_)) return
  await dropCloudVideo(before)
  if (!after_.isPrivate) after(() => requestCloudVideo(before.id))
}
