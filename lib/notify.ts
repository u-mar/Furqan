import { prisma } from '@/lib/prisma'

/**
 * Who did something, from the id the app sends. A database account is looked
 * up; a local-only one (`local_<username>`) is the username itself.
 */
export async function actorFor(userId: string): Promise<{ username: string; name: string } | null> {
  if (userId.startsWith('local_')) {
    const username = userId.slice('local_'.length).toLowerCase()
    return username ? { username, name: username } : null
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, name: true } })
    return user ? { username: user.username.toLowerCase(), name: user.name || user.username } : null
  } catch {
    return null
  }
}

/**
 * Tell a qari their recitation was liked. Never throws: a notification that
 * cannot be written must not undo the like it was about. Liking again after an
 * unlike does not notify twice, and nobody is told about their own likes.
 */
export async function notifyLike(
  recitation: { id: string; userUsername: string; title: string | null },
  actorUserId: string
): Promise<void> {
  try {
    const actor = await actorFor(actorUserId)
    const recipient = recitation.userUsername.toLowerCase()
    if (!actor || actor.username === recipient) return
    const existing = await prisma.notification.findFirst({
      where: { recipientUsername: recipient, type: 'like', actorUsername: actor.username, recitationId: recitation.id },
      select: { id: true },
    })
    if (existing) return
    await prisma.notification.create({
      data: {
        recipientUsername: recipient,
        type: 'like',
        actorUsername: actor.username,
        actorName: actor.name,
        recitationId: recitation.id,
        recitationTitle: recitation.title,
      },
    })
  } catch (err) {
    console.error('[notify] like failed:', err)
  }
}

/** Tell a qari they have a new follower. Same rules as notifyLike. */
export async function notifyFollow(targetUsername: string, actorUserId: string): Promise<void> {
  try {
    const actor = await actorFor(actorUserId)
    const recipient = targetUsername.toLowerCase()
    if (!actor || actor.username === recipient) return
    const existing = await prisma.notification.findFirst({
      where: { recipientUsername: recipient, type: 'follow', actorUsername: actor.username },
      select: { id: true },
    })
    if (existing) return
    await prisma.notification.create({
      data: { recipientUsername: recipient, type: 'follow', actorUsername: actor.username, actorName: actor.name },
    })
  } catch (err) {
    console.error('[notify] follow failed:', err)
  }
}
