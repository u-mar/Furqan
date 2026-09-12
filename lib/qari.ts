/** Client-side access to the Qari recitation feed. */

export interface Recitation {
  id: string
  userName: string
  userUsername: string
  surahId: number
  surahName: string
  fromAyah: number
  toAyah: number
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

export function recitationRangeLabel(r: Pick<Recitation, 'surahName' | 'fromAyah' | 'toAyah'>): string {
  return r.fromAyah === r.toAyah
    ? `${r.surahName} · ${r.fromAyah}`
    : `${r.surahName} · ${r.fromAyah}–${r.toAyah}`
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** "just now", "4h", "3d", then a date. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export async function fetchFeed(options: {
  sort?: FeedSort
  user?: string
  viewerId?: string | null
  /** Matches reciter name, handle, or surah. */
  query?: string
  skip?: number
}): Promise<FeedPage> {
  const params = new URLSearchParams()
  if (options.sort) params.set('sort', options.sort)
  if (options.user) params.set('user', options.user)
  if (options.viewerId) params.set('viewerId', options.viewerId)
  if (options.query) params.set('q', options.query)
  if (options.skip) params.set('skip', String(options.skip))

  const res = await fetch(`/api/qari?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load recitations.')
  return (await res.json()) as FeedPage
}

async function post(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/qari/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed.')
  return res.json()
}

export function toggleLike(id: string, userId: string, liked: boolean) {
  return post(id, { action: liked ? 'unlike' : 'like', userId }) as Promise<{
    liked: boolean
    likeCount: number
  }>
}

export function countPlay(id: string) {
  return post(id, { action: 'play' }).catch(() => null)
}

export function reportRecitation(id: string, userId: string, reason: string) {
  return post(id, { action: 'report', userId, reason })
}

export async function deleteRecitation(id: string, userId: string): Promise<void> {
  const res = await fetch(`/api/qari/${id}?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Could not delete that recitation.')
}

export interface PublishInput {
  blob: Blob
  mimeType: string
  durationSec: number
  surahId: number
  surahName: string
  fromAyah: number
  toAyah: number
  caption: string
  userId: string
  userName: string
  userUsername: string
}

export async function publishRecitation(input: PublishInput): Promise<string> {
  const form = new FormData()
  const ext = input.mimeType.includes('mp4') ? 'm4a' : input.mimeType.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', input.blob, `recitation.${ext}`)
  form.append('durationSec', String(input.durationSec))
  form.append('surahId', String(input.surahId))
  form.append('surahName', input.surahName)
  form.append('fromAyah', String(input.fromAyah))
  form.append('toAyah', String(input.toAyah))
  form.append('caption', input.caption)
  form.append('userId', input.userId)
  form.append('userName', input.userName)
  form.append('userUsername', input.userUsername)

  const res = await fetch('/api/qari', { method: 'POST', body: form })
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string }
  if (!res.ok || !data.id) throw new Error(data.error || 'Could not publish.')
  return data.id
}

/** Share a recitation — native sheet where available, clipboard otherwise. */
export async function shareRecitation(r: Recitation): Promise<'shared' | 'copied'> {
  const url = `${window.location.origin}/qari/${encodeURIComponent(r.userUsername)}?r=${r.id}`
  const text = `${r.userName} reciting ${recitationRangeLabel(r)}`

  if (navigator.share) {
    try {
      await navigator.share({ title: text, text, url })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  await navigator.clipboard.writeText(`${text}\n${url}`)
  return 'copied'
}
