
import { tr } from '@/lib/i18n-core'

/** Client-side access to the Qari recitation feed. */

export interface Recitation {
  id: string
  userName: string
  userUsername: string
  /** What the reciter called this recording. */
  title: string
  /** Which room it is played back in. */
  space: string
  /** Lower-case, no leading '#'. */
  hashtags: string[]
  /** Visible only to the reciter. */
  isPrivate: boolean
  /** Sheikh id from lib/sheikhs, when the reciter imitated one. */
  imitating: string | null
  /** Loudness across the recording, 0–100. Empty for recordings made before waveforms. */
  peaks: number[]
  caption: string
  durationSec: number
  likeCount: number
  playCount: number
  createdAt: string
  liked: boolean
}

export interface FeedPage {
  items: Recitation[]
  hasMore: boolean
}

export type FeedSort = 'recent' | 'top'

export function recitationAudioUrl(id: string): string {
  return `/api/qari/audio/${id}`
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 950, 1.4k, 12k, 2.1m — for play and heart counts. */
export function compactNumber(value: number): string {
  if (value < 1000) return String(value)
  if (value < 1_000_000) {
    const k = value / 1000
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`
  }
  const m = value / 1_000_000
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}m`
}

/** "just now", "4h", "3d", then a date. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return tr('just now')
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/* ------------------------------------------------------------------ memory */

/*
 * What each screen last showed is kept on the phone, so it opens at once with
 * that and the server only brings it up to date. Waiting on a database for a
 * list that was there a minute ago is what made these screens open on a skeleton.
 */
const MEMORY_PREFIX = 'muyassar_qari_'
const MEMORY_DAYS = 7

function remember(key: string, data: unknown) {
  try {
    localStorage.setItem(MEMORY_PREFIX + key, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // A full disk only costs the shortcut.
  }
}

function recall<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(MEMORY_PREFIX + key)
    if (!raw) return null
    const saved = JSON.parse(raw) as { at?: number; data?: T }
    if (!saved.at || Date.now() - saved.at > MEMORY_DAYS * 86_400_000) return null
    return saved.data ?? null
  } catch {
    return null
  }
}

type FeedOptions = Parameters<typeof fetchFeed>[0]

/** Only a plain first page is kept: a search or "load more" is never worth remembering. */
function feedKey(o: FeedOptions): string | null {
  if (o.query || o.skip) return null
  return [
    'feed',
    o.sort ?? 'recent',
    o.user ?? '',
    o.likedBy ? 'liked' : '',
    o.imitating ?? '',
    o.following ? 'following' : '',
    o.take ?? '',
    o.viewerId ?? 'anon',
  ].join(':')
}

/** The first page as it was last seen, or null. */
export function peekFeed(options: FeedOptions): FeedPage | null {
  const key = feedKey(options)
  return key ? recall<FeedPage>(key) : null
}

export function peekDiscover(): Discover | null {
  return recall<Discover>('discover')
}

export async function fetchFeed(options: {
  sort?: FeedSort
  user?: string
  viewerId?: string | null
  /** Only recitations this user has hearted — the favourites tab. */
  likedBy?: string | null
  /** Matches reciter name, handle, or recitation title. */
  query?: string
  /** Only imitations of this sheikh. */
  imitating?: string
  /** Only people the viewer follows. */
  following?: boolean
  skip?: number
  take?: number
}): Promise<FeedPage> {
  const params = new URLSearchParams()
  if (options.sort) params.set('sort', options.sort)
  if (options.user) params.set('user', options.user)
  if (options.viewerId) params.set('viewerId', options.viewerId)
  if (options.likedBy) params.set('likedBy', options.likedBy)
  if (options.query) params.set('q', options.query)
  if (options.imitating) params.set('imitating', options.imitating)
  if (options.following) params.set('following', '1')
  if (options.skip) params.set('skip', String(options.skip))
  if (options.take) params.set('take', String(options.take))

  const res = await fetch(`/api/qari?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(tr('Could not load recitations.'))
  const page = (await res.json()) as FeedPage
  const key = feedKey(options)
  if (key) remember(key, page)
  return page
}

async function post(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/qari/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || tr('Request failed.'))
  return res.json()
}

export function toggleLike(id: string, userId: string, liked: boolean) {
  return post(id, { action: liked ? 'unlike' : 'like', userId }) as Promise<{
    liked: boolean
    likeCount: number
  }>
}

/** The reciter's own listens don't count, so the id has to travel with it. */
export function countPlay(id: string, userId: string | null) {
  return post(id, { action: 'play', userId: userId ?? undefined }).catch(() => null)
}

export function reportRecitation(id: string, userId: string, reason: string) {
  return post(id, { action: 'report', userId, reason })
}

/** Only the reciter may call this — flips who can hear their own recording. */
export async function setRecitationPrivacy(id: string, userId: string, isPrivate: boolean): Promise<void> {
  await post(id, { action: 'setPrivacy', userId, isPrivate })
}

export async function deleteRecitation(id: string, userId: string): Promise<void> {
  const res = await fetch(`/api/qari/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(tr('Could not delete that recitation.'))
}

export interface PublishInput {
  blob: Blob
  mimeType: string
  durationSec: number
  title: string
  space: string
  /** Free text — the server tidies it into a list. */
  hashtags: string
  isPrivate: boolean
  caption: string
  /** Sheikh id, or empty when not imitating. */
  imitating: string
  peaks: number[]
  userId: string
  userName: string
  userUsername: string
}

export async function publishRecitation(input: PublishInput): Promise<string> {
  const form = new FormData()
  const ext = input.mimeType.includes('mp4') ? 'm4a' : input.mimeType.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', input.blob, `recitation.${ext}`)
  form.append('durationSec', String(input.durationSec))
  form.append('title', input.title)
  form.append('space', input.space)
  form.append('hashtags', input.hashtags)
  form.append('isPrivate', String(input.isPrivate))
  form.append('caption', input.caption)
  form.append('imitating', input.imitating)
  form.append('peaks', JSON.stringify(input.peaks))
  form.append('userId', input.userId)
  form.append('userName', input.userName)
  form.append('userUsername', input.userUsername)

  const res = await fetch('/api/qari', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
  if (!res.ok || !data.id) throw new Error(data.error || tr('Could not publish.'))
  return data.id
}

/**
 * Change the display name on a profile, everywhere it appears.
 *
 * Returns the stored name so the caller can write it back to the signed-in
 * user without guessing how the server trimmed it.
 */
export async function renameQari(user: {
  id: string
  username: string
}, name: string): Promise<string> {
  const res = await fetch('/api/qari/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.username, userId: user.id, name }),
  })
  const data = (await res.json().catch(() => ({}))) as { name?: string; error?: string }
  if (!res.ok || !data.name) throw new Error(data.error || tr('Could not save that name.'))
  return data.name
}

/**
 * The downloaded recording, kept so a share never fetches it twice.
 *
 * Started early — on the press, before the tap completes — because iOS only
 * honours navigator.share while it still considers itself inside the gesture,
 * and a cold download is far too slow for that.
 */
const audioBlobs = new Map<string, Promise<Blob | null>>()

/** Hand over a recording already on the phone — just published — so sharing it needs no download. */
export function primeRecitationAudio(id: string, blob: Blob): void {
  audioBlobs.set(id, Promise.resolve(blob))
}

/**
 * The same tidy-up the server does to hashtags, so the chips shown while
 * typing are exactly what will be saved.
 */
export function tidyHashtags(raw: string): string[] {
  const seen = new Set<string>()
  for (const piece of raw.split(/[\s,]+/)) {
    const tag = piece
      .replace(/^#+/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_؀-ۿ]/g, '')
      .slice(0, 24)
    if (tag) seen.add(tag)
    if (seen.size >= 6) break
  }
  return [...seen]
}

export function prefetchRecitationAudio(id: string): Promise<Blob | null> {
  let pending = audioBlobs.get(id)
  if (!pending) {
    pending = fetch(recitationAudioUrl(id))
      .then((res) => (res.ok ? res.blob() : null))
      .catch(() => null)
    audioBlobs.set(id, pending)
  }
  return pending
}


/* ---------------------------------------------------------------- discover */

export interface TagCount {
  tag: string
  count: number
}

export interface SheikhCount {
  id: string
  count: number
}

export interface LovedQari {
  username: string
  name: string
  /** Hearts across all of their public recitations. */
  likes: number
}

export interface Discover {
  /** Hashtags people use most, for the row under search. */
  tags: TagCount[]
  /** Sheikhs with the most imitations. */
  sheikhs: SheikhCount[]
  /** Qaris whose recitations have the most hearts altogether. */
  lovedQaris: LovedQari[]
}

export async function fetchDiscover(): Promise<Discover> {
  const res = await fetch('/api/qari/discover', { cache: 'no-store' })
  if (!res.ok) throw new Error(tr('Could not load Qari.'))
  const discover = (await res.json()) as Discover
  remember('discover', discover)
  return discover
}

/** How many people imitated one sheikh, and from how many different qaris. */
export async function fetchSheikhStats(sheikhId: string): Promise<{ count: number; people: number }> {
  const res = await fetch(`/api/qari/discover?sheikh=${encodeURIComponent(sheikhId)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return { count: 0, people: 0 }
  return (await res.json()) as { count: number; people: number }
}

/* ------------------------------------------------------------------ follow */

export interface QariSummary {
  username: string
  name: string
  recitations: number
  /** Whether the viewer follows them. */
  following: boolean
}

export async function fetchQaris(options: {
  viewerId: string | null
  query?: string
  onlyFollowing?: boolean
}): Promise<QariSummary[]> {
  const params = new URLSearchParams()
  if (options.viewerId) params.set('viewerId', options.viewerId)
  if (options.query) params.set('q', options.query)
  if (options.onlyFollowing) params.set('following', '1')
  const res = await fetch(`/api/qari/qaris?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(tr('Could not load qaris.'))
  return ((await res.json()) as { items: QariSummary[] }).items
}

export async function setFollowing(
  viewer: { id: string; username: string },
  target: string,
  follow: boolean
): Promise<{ following: boolean; followers: number }> {
  const res = await fetch('/api/qari/follow', {
    method: follow ? 'POST' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: viewer.id, username: viewer.username, target }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    following?: boolean
    followers?: number
    error?: string
  }
  if (!res.ok) throw new Error(data.error || tr('Could not update that.'))
  return { following: Boolean(data.following), followers: data.followers ?? 0 }
}

export async function fetchFollowState(
  target: string,
  viewerId: string | null
): Promise<{ following: boolean; followers: number }> {
  const params = new URLSearchParams({ target })
  if (viewerId) params.set('viewerId', viewerId)
  const res = await fetch(`/api/qari/follow?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return { following: false, followers: 0 }
  return (await res.json()) as { following: boolean; followers: number }
}
