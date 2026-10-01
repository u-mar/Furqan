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
    kind: r.kind === 'ayah' ? ('ayah' as const) : ('recitation' as const),
    verseKey: r.verseKey ?? null,
    // Its picture through the app's own route, which hides it with the post.
    imageUrl: r.imageId ? `/api/qari/image/${r.id}` : null,
    userName: r.userName,
    userUsername: r.userUsername,
    title: r.title || 'Recitation',
    space: r.space || 'clean',
    hashtags: r.hashtags ?? [],
    isPrivate: r.isPrivate === true,
    imitating: r.imitating ?? null,
    peaks: r.peaks ?? [],
    verseTimeline: Array.isArray(r.verseTimeline) ? (r.verseTimeline as { verseKey: string; atSeconds: number; words?: number[] }[]) : [],
    background: r.background ?? null,
    caption: r.caption,
    durationSec: r.durationSec,
    likeCount: r.likeCount,
    playCount: r.playCount,
    createdAt: r.createdAt.toISOString(),
    liked,
  }
}
