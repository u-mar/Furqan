import { prisma } from '@/lib/prisma'
import { sendPush } from '@/lib/push'

/** Where the site lives, for the picture a notification carries (phones fetch it themselves). */
const SITE = (process.env.APP_URL || 'https://qurannaba.com').replace(/\/$/, '')

/** A qari's profile picture, as a notification shows it beside their name. */
function avatarOf(username: string): string {
  return `${SITE}/api/qari/avatar/${encodeURIComponent(username)}`
}

/** Worth telling someone about — small numbers as much as round ones, since most recitations never reach the big ones. */
export const PLAY_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
export const LIKE_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000]

/**
 * Who did something, from the id the app sends. A database account is looked
 * up; a local-only one (`local_<username>`) is the username itself.
 */
export async function actorFor(userId: string): Promise<{ username: string; name: string } | null> {
  // Someone without an account has no name to show: their like still counts, quietly.
  if (userId.startsWith('guest_')) return null
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
      title: actor.name,
      body: recitation.title ? `liked your recitation “${recitation.title}”` : 'liked your recitation',
      image: avatarOf(actor.username),
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
      title: actor.name,
      body: 'started following you',
      image: avatarOf(actor.username),
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
      title: label,
      body: kind === 'plays' ? `just passed ${count} plays` : `just passed ${count} likes`,
      url: '/qari/notifications',
      tag: `milestone-${recitation.id}-${kind}-${count}`,
    })
  } catch (err) {
    console.error('[notify] milestone failed:', err)
  }
}

/**
 * Tell a reciter the admin has decided on their application to be verified: the badge is theirs,
 * or not this time (they may apply again). Never throws: the decision stands either way.
 */
export async function notifyVerification(recipientUsername: string, recipientName: string, approved: boolean): Promise<void> {
  try {
    const recipient = recipientUsername.toLowerCase()
    await prisma.notification.create({
      data: {
        recipientUsername: recipient,
        type: approved ? 'verified' : 'verify-declined',
        // There is no other actor: like a milestone, the reciter themselves.
        actorUsername: recipient,
        actorName: recipientName || recipient,
      },
    })
    await sendPush(recipient, {
      title: approved ? 'You are now a verified reciter' : 'Your verification request',
      body: approved
        ? 'Your badge is on your Qari profile.'
        : 'It was not approved this time. You can apply again from your profile.',
      url: `/qari/${encodeURIComponent(recipient)}`,
      tag: `verification-${recipient}`,
    })
  } catch (err) {
    console.error('[notify] verification failed:', err)
  }
}
