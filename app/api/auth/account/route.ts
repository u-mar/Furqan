import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPin } from '@/lib/pin-hash'
import { ownsUsername } from '@/lib/qari-owner'
import { removeAudio, removeFile } from '@/lib/qari-storage'

export const runtime = 'nodejs'

/**
 * DELETE /api/auth/account — delete an account and everything it published.
 *
 * Both app stores require in-app account deletion for any app that lets
 * people create accounts, and it has to remove the person's data, not merely
 * sign them out. So this takes the recitations and their audio, the profile
 * picture, and the likes and reports tied to either side.
 *
 * Database accounts must re-enter their PIN. Local-only accounts keep their
 * PIN on the device, which checks it before calling; here they are held to
 * the same ownership rule as every other Qari write.
 */
export async function DELETE(req: Request) {
  let body: { username?: string; userId?: string; pin?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const username = (body.username ?? '').trim().toLowerCase()
  const userId = (body.userId ?? '').trim()
  const pin = (body.pin ?? '').trim()

  if (!username || !userId) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }

  try {
    const account = await prisma.user.findUnique({ where: { username } })

    if (account) {
      if (account.id !== userId) {
        return NextResponse.json({ error: 'That is not your account.' }, { status: 403 })
      }
      const { ok } = await verifyPin(pin, account.pinHash)
      if (!ok) {
        return NextResponse.json({ error: 'That PIN is not right.' }, { status: 401 })
      }
    } else if (!(await ownsUsername(username, userId))) {
      return NextResponse.json({ error: 'That is not your account.' }, { status: 403 })
    }

    const recitations = await prisma.recitation.findMany({
      where: { userUsername: username },
      select: { id: true, audioId: true },
    })
    const recitationIds = recitations.map((r) => r.id)

    // Stored files first: if a later step fails, re-running this finds the
    // rows still there and tries again, rather than leaving orphaned audio.
    for (const r of recitations) {
      await removeAudio(r.audioId).catch(() => {})
    }
    const avatar = await prisma.qariAvatar.findUnique({ where: { username } })
    if (avatar) await removeFile(avatar.imageId, 'qari_avatars').catch(() => {})

    await prisma.recitationLike.deleteMany({
      where: { OR: [{ userId }, { recitationId: { in: recitationIds } }] },
    })
    await prisma.recitationReport.deleteMany({
      where: { OR: [{ userId }, { recitationId: { in: recitationIds } }] },
    })
    await prisma.recitation.deleteMany({ where: { userUsername: username } })
    if (avatar) await prisma.qariAvatar.delete({ where: { username } })
    if (account) await prisma.user.delete({ where: { id: account.id } })

    return NextResponse.json({ deleted: true, recitations: recitations.length })
  } catch (error) {
    console.error('[auth] account deletion failed:', error)
    return NextResponse.json(
      { error: 'Could not delete the account. Please try again.' },
      { status: 500 }
    )
  }
}
