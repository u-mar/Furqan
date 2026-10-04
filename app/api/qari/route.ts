import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'
import { likedIdsFor, toClientRecitation } from '@/lib/qari-serialize'
import { MAX_AUDIO_BYTES, MAX_DURATION_SEC, MAX_IMAGE_BYTES, putAudio, putImage } from '@/lib/qari-storage'
import { isSheikhId, matchSheikh } from '@/lib/sheikhs'
import { isVideoBackgroundId } from '@/lib/qari-backgrounds'
import { blockedUsernamesFor } from '@/lib/qari-blocks-server'

export const runtime = 'nodejs'

const FEED_PAGE_SIZE = 20
const MAX_PEAKS = 64
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

/** A waveform sent from the phone: at most MAX_PEAKS whole numbers from 0 to 100. */
function parsePeaks(raw: string): number[] {
  try {
    const value: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(value)) return []
    return value
      .slice(0, MAX_PEAKS)
      .map((n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0))))
  } catch {
    return []
  }
}

const MAX_VERSE_TIMELINE = 1000
const VERSE_KEY_RE = /^\d{1,3}:\d{1,3}$/

/** Ayah markings sent from the phone while reading from the Mushaf — dropped
 *  silently if malformed, since this only ever enriches the share video. */
/** The longest ayah (2:282) has 128 words. */
const MAX_AYAH_WORDS = 200

function parseVerseTimeline(raw: string, maxSeconds: number): { verseKey: string; atSeconds: number; words?: number[] }[] {
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(maxSeconds, n)) * 100) / 100
  try {
    const value: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(value)) return []
    return value
      .slice(0, MAX_VERSE_TIMELINE)
      .filter(
        (entry): entry is { verseKey: string; atSeconds: number } =>
          Boolean(entry) &&
          typeof entry === 'object' &&
          typeof (entry as { verseKey?: unknown }).verseKey === 'string' &&
          VERSE_KEY_RE.test((entry as { verseKey: string }).verseKey) &&
          Number.isFinite((entry as { atSeconds?: unknown }).atSeconds)
      )
      .map((entry) => {
        const words = (entry as { words?: unknown }).words
        const keep =
          Array.isArray(words) && words.length > 0 && words.length <= MAX_AYAH_WORDS && words.every((w) => Number.isFinite(w))
        return {
          verseKey: entry.verseKey,
          atSeconds: Math.max(0, Math.min(maxSeconds, entry.atSeconds)),
          ...(keep ? { words: (words as number[]).map(clamp) } : {}),
        }
      })
  } catch {
    return []
  }
}

/**
 * GET /api/qari?sort=recent|top&user=username&likedBy=userId&imitating=sheikhId
 *   &following=1&viewerId=&q=&skip=&take=
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sort = searchParams.get('sort') === 'top' ? 'top' : 'recent'
  const username = searchParams.get('user')?.trim()
  const viewerId = searchParams.get('viewerId')?.trim()
  const likedBy = searchParams.get('likedBy')?.trim()
  const query = searchParams.get('q')?.trim().slice(0, 60)
  const imitatingParam = searchParams.get('imitating')?.trim() ?? ''
  const imitating = isSheikhId(imitatingParam) ? imitatingParam : null
  const onlyFollowing = searchParams.get('following') === '1'
  const skip = Math.max(0, Number(searchParams.get('skip') || '0'))
  const take = Math.min(50, Math.max(1, Number(searchParams.get('take') || FEED_PAGE_SIZE)))
  // A search for "#tajweed" should find the tag, not the literal text.
  const tagQuery = query?.startsWith('#') ? query.slice(1).toLowerCase() : null
  // "sheikh sufi" also finds everything imitating him.
  const sheikhQuery = query && !imitating ? matchSheikh(query) : null

  try {
    // People this viewer blocked are left out everywhere; their own profile shows nothing.
    const blocked = await blockedUsernamesFor(viewerId)
    if (username && blocked.includes(username.toLowerCase())) return NextResponse.json({ items: [], hasMore: false })

    // Only the people this viewer follows.
    let followingFilter: { userUsername: { in: string[] } } | null = null
    if (onlyFollowing) {
      if (!viewerId) return NextResponse.json({ items: [], hasMore: false })
      const follows = await prisma.qariFollow.findMany({
        where: { followerId: viewerId },
        select: { followingUsername: true },
      })
      if (follows.length === 0) return NextResponse.json({ items: [], hasMore: false })
      followingFilter = { userUsername: { in: follows.map((f) => f.followingUsername) } }
    }

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
      ? {
          OR: [
            { hashtags: { has: tagQuery } },
            ...(sheikhQuery ? [{ imitating: sheikhQuery.id }] : []),
          ],
        }
      : query
        ? {
            OR: [
              { userName: { contains: query, mode: 'insensitive' as const } },
              { userUsername: { contains: query, mode: 'insensitive' as const } },
              { title: { contains: query, mode: 'insensitive' as const } },
              { hashtags: { has: query.toLowerCase() } },
              ...(sheikhQuery ? [{ imitating: sheikhQuery.id }] : []),
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
      ...(followingFilter ?? {}),
      ...(imitating ? { imitating } : {}),
      ...(likedFilter ?? {}),
      ...search,
      ...(blocked.length ? { AND: [{ userUsername: { notIn: blocked } }] } : {}),
    }

    const recitations = await prisma.recitation.findMany({
      where,
      orderBy: sort === 'top' ? [{ likeCount: 'desc' }, { createdAt: 'desc' }] : { createdAt: 'desc' },
      skip,
      take,
    })

    const likedIds = await likedIdsFor(viewerId, recitations.map((r) => r.id))

    return NextResponse.json({
      items: recitations.map((r) => toClientRecitation(r, likedIds.has(r.id))),
      hasMore: recitations.length === take,
    })
  } catch (err) {
    console.error('[qari] feed failed:', err)
    return NextResponse.json({ error: 'Could not load recitations.' }, { status: 500 })
  }
}

/** POST /api/qari — publish a recording (multipart form). */
const VERSE_KEY_ONLY_RE = /^\d{1,3}:\d{1,3}$/
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp']

/** An ayah card from the Read screen's share page, posted as a picture. */
async function postAyahCard(form: FormData): Promise<NextResponse> {
  const file = form.get('image')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No picture was attached.' }, { status: 400 })
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'That picture is too large.' }, { status: 413 })
  }
  const mimeType = (file.type || 'image/jpeg').split(';')[0]
  if (!ALLOWED_IMAGE_MIME.includes(mimeType)) {
    return NextResponse.json({ error: 'Unsupported picture format.' }, { status: 415 })
  }

  const userId = clean(form.get('userId'), 64)
  const userName = clean(form.get('userName'), 60)
  const userUsername = clean(form.get('userUsername'), 40)
  if (!userId || !userUsername) {
    return NextResponse.json({ error: 'Sign in to post.' }, { status: 401 })
  }

  const verseKey = clean(form.get('verseKey'), 7)
  if (!VERSE_KEY_ONLY_RE.test(verseKey)) {
    return NextResponse.json({ error: 'Which ayah is this?' }, { status: 400 })
  }
  const title = clean(form.get('title'), 80) || verseKey

  const buffer = Buffer.from(await file.arrayBuffer())
  const imageId = await putImage(buffer, { filename: `${userUsername}-ayah-${Date.now()}`, mimeType })

  const created = await prisma.recitation.create({
    data: {
      kind: 'ayah',
      userId,
      userName: userName || userUsername,
      userUsername,
      imageId,
      verseKey,
      mimeType,
      durationSec: 0,
      sizeBytes: buffer.length,
      title,
      hashtags: parseHashtags(clean(form.get('hashtags'), 200)),
      isPrivate: clean(form.get('isPrivate'), 5) === 'true',
      peaks: [],
      caption: clean(form.get('caption'), 280),
    },
  })
  return NextResponse.json({ id: created.id }, { status: 201 })
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    if (clean(form.get('kind'), 10) === 'ayah') return await postAyahCard(form)
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
    const space = clean(form.get('space'), 16) || 'clean'
    const hashtags = parseHashtags(clean(form.get('hashtags'), 200))
    const isPrivate = clean(form.get('isPrivate'), 5) === 'true'
    const imitatingRaw = clean(form.get('imitating'), 40)
    const imitating = isSheikhId(imitatingRaw) ? imitatingRaw : null
    const peaks = parsePeaks(clean(form.get('peaks'), 1200))
    const backgroundRaw = clean(form.get('background'), 80)
    const background = isVideoBackgroundId(backgroundRaw) ? backgroundRaw : null
    const durationSec = Math.round(Number(form.get('durationSec') || 0))
    if (!title) {
      return NextResponse.json({ error: 'Give your recitation a title.' }, { status: 400 })
    }
    if (durationSec <= 0 || durationSec > MAX_DURATION_SEC) {
      return NextResponse.json({ error: 'Recording length is out of range.' }, { status: 400 })
    }
    const verseTimelineRaw = form.get('verseTimeline')
    const verseTimeline = parseVerseTimeline(
      typeof verseTimelineRaw === 'string' ? verseTimelineRaw : '',
      durationSec
    )

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
        space,
        hashtags,
        isPrivate,
        // Left off entirely rather than stored as null, so "imitating anyone"
        // stays a plain equality match on MongoDB.
        ...(imitating ? { imitating } : {}),
        peaks,
        // Left off entirely rather than stored as an empty array, matching
        // `imitating` above — keeps rows from before this existed and rows
        // genuinely marked with nothing indistinguishable, which is fine
        // since both read back as "no caption text to show."
        ...(verseTimeline.length ? { verseTimeline } : {}),
        ...(background ? { background } : {}),
        caption: clean(form.get('caption'), 280),
      },
    })

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (err) {
    console.error('[qari] publish failed:', err)
    return NextResponse.json({ error: 'Could not publish the recitation.' }, { status: 500 })
  }
}
