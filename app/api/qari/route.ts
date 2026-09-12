import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'
import { MAX_AUDIO_BYTES, MAX_DURATION_SEC, putAudio } from '@/lib/qari-storage'

export const runtime = 'nodejs'

const FEED_PAGE_SIZE = 20
const ALLOWED_MIME = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']

const MAX_TAGS = 6
const MAX_TAG_LEN = 24

function clean(value: FormDataEntryValue | null, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Accepts whatever shape the reciter typed — "#tajweed, baqarah  #night" —
 * and returns a tidy, de-duplicated list with no '#' and no empties.
 */
function parseHashtags(raw: string): string[] {
  const seen = new Set<string>()
  for (const piece of raw.split(/[\s,]+/)) {
    const tag = piece
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_؀-ۿ]/g, '')
      .slice(0, MAX_TAG_LEN)
    if (tag) seen.add(tag)
    if (seen.size >= MAX_TAGS) break
  }
  return [...seen]
}

/** GET /api/qari?sort=recent|top&user=username&likedBy=userId&q=&skip= */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') === 'top' ? 'top' : 'recent'
  const username = searchParams.get('user')?.trim()
  const viewerId = searchParams.get('viewerId')?.trim()
  const likedBy = searchParams.get('likedBy')?.trim()
  const query = searchParams.get('q')?.trim().slice(0, 60)
  const skip = Math.max(0, Number(searchParams.get('skip') || '0'))
  // A search for "#tajweed" should find the tag, not the literal text.
  const tagQuery = query?.startsWith('#') ? query.slice(1).toLowerCase() : null

  try {
    // The favourites tab: the ids this user has hearted. Collected first so
    // the recitations themselves are still one findMany.
    let likedFilter: { id: { in: string[] } } | null = null
    if (likedBy) {
      const likes = await prisma.recitationLike.findMany({
        where: { userId: likedBy },
        select: { recitationId: true },
      })
      if (likes.length === 0) {
        return NextResponse.json({ items: [], hasMore: false })
      }
      likedFilter = { id: { in: likes.map((l) => l.recitationId) } }
    }

    // Matches a reciter's name or handle, what they called the recording, or
    // one of its hashtags.
    const search = tagQuery
      ? { hashtags: { has: tagQuery } }
      : query
        ? {
            OR: [
              { userName: { contains: query, mode: 'insensitive' as const } },
              { userUsername: { contains: query, mode: 'insensitive' as const } },
              { title: { contains: query, mode: 'insensitive' as const } },
              { hashtags: { has: query.toLowerCase() } },
            ],
          }
        : {}

    // Private recordings belong to their reciter alone. They surface only on
    // that person's own profile, and only once the server has confirmed the
    // caller really is them.
    const ownProfile =
      Boolean(username) && Boolean(viewerId) && (await ownsUsername(username!, viewerId!))

    const where = {
      hidden: false,
      // Every row carries `isPrivate` — the ones made before it existed were
      // backfilled to false. Prisma on MongoDB cannot match an absent field,
      // so this has to stay true of anything written here.
      ...(ownProfile ? {} : { isPrivate: false }),
      ...(username ? { userUsername: username } : {}),
      ...(likedFilter ?? {}),
      ...search,
    }

    const recitations = await prisma.recitation.findMany({
      where,
      orderBy: sort === 'top' ? [{ likeCount: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
      skip,
      take: FEED_PAGE_SIZE,
    })

    // Which of these the viewer has already liked, in one query.
    let likedIds = new Set<string>()
    if (viewerId && recitations.length > 0) {
      const likes = await prisma.recitationLike.findMany({
        where: { userId: viewerId, recitationId: { in: recitations.map((r) => r.id) } },
        select: { recitationId: true },
      })
      likedIds = new Set(likes.map((l) => l.recitationId))
    }

    return NextResponse.json({
      items: recitations.map((r) => ({
        id: r.id,
        userName: r.userName,
        userUsername: r.userUsername,
        title: r.title || 'Recitation',
        hashtags: r.hashtags ?? [],
        isPrivate: r.isPrivate === true,
        caption: r.caption,
        durationSec: r.durationSec,
        likeCount: r.likeCount,
        playCount: r.playCount,
        createdAt: r.createdAt.toISOString(),
        liked: likedIds.has(r.id),
      })),
      hasMore: recitations.length === FEED_PAGE_SIZE,
    })
  } catch (err) {
    console.error('[qari] feed failed:', err)
    return NextResponse.json({ error: 'Could not load recitations.' }, { status: 500 })
  }
}

/** POST /api/qari — publish a recording (multipart form). */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('audio')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No audio was attached.' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'The recording is empty.' }, { status: 400 })
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'That recording is too long to upload.' }, { status: 413 })
    }

    const mimeType = (file.type || 'audio/webm').split(';')[0]
    if (!ALLOWED_MIME.includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported audio format.' }, { status: 415 })
    }

    const userId = clean(form.get('userId'), 64)
    const userName = clean(form.get('userName'), 60)
    const userUsername = clean(form.get('userUsername'), 40)
    if (!userId || !userUsername) {
      return NextResponse.json({ error: 'Sign in to publish a recitation.' }, { status: 401 })
    }

    const title = clean(form.get('title'), 80)
    const hashtags = parseHashtags(clean(form.get('hashtags'), 200))
    const isPrivate = clean(form.get('isPrivate'), 5) === 'true'
    const durationSec = Math.round(Number(form.get('durationSec') || 0))
    if (!title) {
      return NextResponse.json({ error: 'Give your recitation a title.' }, { status: 400 })
    }
    if (durationSec <= 0 || durationSec > MAX_DURATION_SEC) {
      return NextResponse.json({ error: 'Recording length is out of range.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const audioId = await putAudio(buffer, {
      filename: `${userUsername}-${Date.now()}`,
      mimeType,
    })

    const created = await prisma.recitation.create({
      data: {
        userId,
        userName: userName || userUsername,
        userUsername,
        audioId,
        mimeType,
        durationSec,
        sizeBytes: buffer.length,
        title,
        hashtags,
        isPrivate,
        caption: clean(form.get('caption'), 280),
      },
    })

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (err) {
    console.error('[qari] publish failed:', err)
    return NextResponse.json({ error: 'Could not publish the recitation.' }, { status: 500 })
  }
}
