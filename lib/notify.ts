import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'

/** Worth telling someone about — small numbers as much as round ones, since most recitations never reach the big ones. */
export const PLAY_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
export const LIKE_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000]

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
    await sendPush(recipient, {
      title: `${actor.name} liked your recitation`,
      body: recitation.title ? `“${recitation.title}”` : 'Open Qari to hear who.',
      url: '/qari/notifications',
      tag: `like-${recitation.id}`,
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
    await sendPush(recipient, {
      title: `${actor.name} started following you`,
      body: 'Open Qari to see your new follower.',
      url: '/qari/notifications',
      tag: `follow-${actor.username}`,
    })
  } catch (err) {
    console.error('[notify] follow failed:', err)
  }
}

/**
 * Tell a qari their own recitation just crossed a round number of plays or
 * likes. Called with the exact new count after an increment — never throws,
 * and re-crossing the same number (there is no way to, since counts only
 * move by one) would just find the existing row and stop.
 */
export async function notifyMilestone(
  recitation: { id: string; userUsername: string; userName: string; title: string | null },
  kind: 'plays' | 'likes',
  count: number
): Promise<void> {
  try {
    const recipient = recitation.userUsername.toLowerCase()
    const existing = await prisma.notification.findFirst({
      where: { recipientUsername: recipient, type: 'milestone', recitationId: recitation.id, milestoneKind: kind, milestoneCount: count },
      select: { id: true },
    })
    if (existing) return
    await prisma.notification.create({
      data: {
        recipientUsername: recipient,
        type: 'milestone',
        actorUsername: recipient,
        actorName: recitation.userName,
        recitationId: recitation.id,
        recitationTitle: recitation.title,
        milestoneKind: kind,
        milestoneCount: count,
      },
    })
    const label = recitation.title ? `“${recitation.title}”` : 'Your recitation'
    await sendPush(recipient, {
      title: kind === 'plays' ? `${label} just passed ${count} plays` : `${label} just passed ${count} likes`,
      body: 'Open Qari to see it.',
      url: '/qari/notifications',
      tag: `milestone-${recitation.id}-${kind}-${count}`,
    })
  } catch (err) {
    console.error('[notify] milestone failed:', err)
  }
}
