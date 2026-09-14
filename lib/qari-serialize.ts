import type { Recitation as RecitationRecord } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Which of these recitations the viewer has hearted, in one query. */
export async function likedIdsFor(viewerId: string | null | undefined, ids: string[]): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set()
  const likes = await prisma.recitationLike.findMany({
    where: { userId: viewerId, recitationId: { in: ids } },
    select: { recitationId: true },
  })
  return new Set(likes.map((l) => l.recitationId))
}

/** The shape the app reads — no author ids, no storage handles. */
export function toClientRecitation(r: RecitationRecord, liked: boolean) {
  return {
    id: r.id,
    userName: r.userName,
    userUsername: r.userUsername,
    title: r.title || 'Recitation',
    space: r.space || 'clean',
    hashtags: r.hashtags ?? [],
    isPrivate: r.isPrivate === true,
    imitating: r.imitating ?? null,
    peaks: r.peaks ?? [],
    caption: r.caption,
    durationSec: r.durationSec,
    likeCount: r.likeCount,
    playCount: r.playCount,
    createdAt: r.createdAt.toISOString(),
    liked,
  }
}
