import { createHash, createHmac, randomUUID } from 'node:crypto'
import type { ListenReciter, ListenSurah, Prisma } from '@prisma/client'
import { LISTEN_QARI_PREFIX, type ListenSurahReport, type PublicListenQari } from '@/lib/listen-qaris'
import { prisma } from '@/lib/prisma'
import { r2Delete, r2PresignPut, r2PublicUrl, r2Ready } from '@/lib/r2'

/**
 * Listen qaris on the server: the admin's records of them and their surahs, the permission the
 * admin's browser gets to send a surah to the speech service for its check, and what Listen sees.
 */

const STORAGE_PREFIX = 'listen/v1'
/** Long enough to send a two-hour surah on a slow connection. */
const UPLOAD_SECONDS = 60 * 60

export function speechService(): { url: string; key: string } | null {
  const url = process.env.ASR_URL?.trim().replace(/\/+$/, '')
  const key = process.env.ASR_API_KEY?.trim()
  return url && key ? { url, key } : null
}

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
}

/** A slug no other Listen qari has: `name`, then `name_2`, … */
export async function freeSlug(name: string): Promise<string> {
  const base = slugify(name) || 'qari'
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}_${n}`
    if (!(await prisma.listenReciter.findFirst({ where: { slug }, select: { id: true } }))) return slug
  }
  return `${base}_${randomUUID().slice(0, 6)}`
}

function pad(surah: number): string {
  return String(surah).padStart(3, '0')
}

export function photoKey(slug: string): string {
  return `${STORAGE_PREFIX}/${slug}/photo-${randomUUID().slice(0, 8)}.jpg`
}

export interface AdminListenSurah {
  id: string
  surah: number
  status: string
  step: string | null
  fileName: string | null
  audioUrl: string
  report: ListenSurahReport | null
  /** verse key → [from ms, to ms], so the admin can jump to an ayah the check flagged. */
  timings: Record<string, [number, number]> | null
  error: string | null
  createdAt: string
  approvedAt: string | null
}

export interface AdminListenReciter {
  id: string
  listenId: string
  slug: string
  name: string
  nameAr: string | null
  country: string
  city: string | null
  qiraat: string
  style: string
  username: string | null
  photoUrl: string | null
  published: boolean
  surahs: AdminListenSurah[]
}

export function serializeSurah(row: ListenSurah): AdminListenSurah {
  return {
    id: row.id,
    surah: row.surah,
    status: row.status,
    step: row.step,
    fileName: row.fileName,
    audioUrl: r2PublicUrl(row.audioKey),
    report: (row.report as unknown as ListenSurahReport | null) ?? null,
    timings: (row.timings as unknown as Record<string, [number, number]> | null) ?? null,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  }
}

export function serializeReciter(row: ListenReciter, surahs: ListenSurah[]): AdminListenReciter {
  return {
    id: row.id,
    listenId: LISTEN_QARI_PREFIX + row.slug,
    slug: row.slug,
    name: row.name,
    nameAr: row.nameAr,
    country: row.country,
    city: row.city,
    qiraat: row.qiraat,
    style: row.style,
    username: row.username,
    photoUrl: row.photoKey ? r2PublicUrl(row.photoKey) : null,
    published: row.published,
    surahs: surahs
      .filter((s) => s.status !== 'replaced')
      .sort((a, b) => a.surah - b.surah || b.createdAt.getTime() - a.createdAt.getTime())
      .map(serializeSurah),
  }
}

/**
 * A new upload of `surah` for this qari: its record, and what the admin's browser needs to send the
 * file to the speech service, which checks it and saves the result at `audioKey` itself.
 */
export async function startSurahUpload(reciter: ListenReciter, surah: number, fileName: string) {
  const service = speechService()
  if (!service) throw new Error('The speech service is not set up (ASR_URL, ASR_API_KEY).')
  if (!r2Ready()) throw new Error('Storage is not set up (R2_*).')

  const job = randomUUID()
  const audioKey = `${STORAGE_PREFIX}/${reciter.slug}/${pad(surah)}-${job.slice(0, 8)}.mp3`
  const putUrl = await r2PresignPut(audioKey, UPLOAD_SECONDS + 60 * 60)
  const expires = Math.floor(Date.now() / 1000) + UPLOAD_SECONDS
  const target = createHash('sha256').update(putUrl).digest('hex')
  const signature = createHmac('sha256', service.key).update(`listen:${job}:${surah}:${expires}:${target}`).digest('hex')

  const row = await prisma.listenSurah.create({
    data: { reciterId: reciter.id, surah, status: 'uploading', jobId: job, audioKey, fileName: fileName.slice(0, 200) || null },
  })
  return {
    surah: serializeSurah(row),
    upload: { url: `${service.url}/listen/upload`, job, surah, putUrl, token: `${expires}.${signature}` },
  }
}

interface JobState {
  status?: 'queued' | 'checking' | 'done' | 'failed' | 'unknown'
  step?: string
  error?: string
  report?: ListenSurahReport & { timings?: Record<string, [number, number]> }
}

/** A surah still being checked: asks the speech service how far it is, and keeps what it says. */
export async function refreshSurah(row: ListenSurah): Promise<ListenSurah> {
  if (row.status !== 'uploading' && row.status !== 'checking') return row
  const service = speechService()
  if (!service) return row
  const res = await fetch(`${service.url}/listen/status/${row.jobId}`, {
    headers: { 'x-api-key': service.key },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)
  if (!res?.ok) return row
  const job = (await res.json().catch(() => ({}))) as JobState

  if (job.status === 'done' && job.report) {
    const { timings, ...report } = job.report
    return prisma.listenSurah.update({
      where: { id: row.id },
      data: {
        status: 'checked',
        step: null,
        report: report as unknown as Prisma.InputJsonValue,
        timings: (timings ?? {}) as unknown as Prisma.InputJsonValue,
      },
    })
  }
  if (job.status === 'failed') {
    return prisma.listenSurah.update({ where: { id: row.id }, data: { status: 'failed', step: null, error: job.error ?? 'The check failed.' } })
  }
  if (job.status === 'queued' || job.status === 'checking') {
    if (row.status === 'checking' && row.step === (job.step ?? null)) return row
    return prisma.listenSurah.update({ where: { id: row.id }, data: { status: 'checking', step: job.step ?? null } })
  }
  // Not heard of yet: the upload is still on its way, or never arrived. After two hours it is given up.
  if (Date.now() - row.createdAt.getTime() > 2 * 60 * 60 * 1000) {
    return prisma.listenSurah.update({ where: { id: row.id }, data: { status: 'failed', error: 'The file never reached the check.' } })
  }
  return row
}

/** Approves one upload; an older approved upload of the same surah is replaced and its file removed. */
export async function approveSurah(row: ListenSurah): Promise<ListenSurah> {
  const older = await prisma.listenSurah.findMany({
    where: { reciterId: row.reciterId, surah: row.surah, status: 'approved', NOT: { id: row.id } },
  })
  for (const old of older) {
    await prisma.listenSurah.update({ where: { id: old.id }, data: { status: 'replaced' } })
    await r2Delete(old.audioKey)
  }
  return prisma.listenSurah.update({ where: { id: row.id }, data: { status: 'approved', approvedAt: new Date() } })
}

export async function removeSurah(row: ListenSurah): Promise<void> {
  await prisma.listenSurah.delete({ where: { id: row.id } })
  await r2Delete(row.audioKey)
}

/** Every published Listen qari with at least one approved surah, for Listen. */
export async function publicListenQaris(): Promise<PublicListenQari[]> {
  const reciters = await prisma.listenReciter.findMany({ where: { published: true }, orderBy: { name: 'asc' } })
  if (!reciters.length) return []
  const surahs = await prisma.listenSurah.findMany({
    where: { reciterId: { in: reciters.map((r) => r.id) }, status: 'approved' },
    select: { reciterId: true, surah: true, audioKey: true },
  })
  const out: PublicListenQari[] = []
  for (const r of reciters) {
    const own = surahs.filter((s) => s.reciterId === r.id).sort((a, b) => a.surah - b.surah)
    if (!own.length) continue
    out.push({
      id: LISTEN_QARI_PREFIX + r.slug,
      name: r.name,
      ...(r.nameAr ? { nameAr: r.nameAr } : {}),
      country: r.country,
      ...(r.city ? { city: r.city } : {}),
      qiraat: r.qiraat,
      style: r.style,
      ...(r.username ? { username: r.username } : {}),
      ...(r.photoKey ? { photoUrl: r2PublicUrl(r.photoKey) } : {}),
      surahs: Object.fromEntries(own.map((s) => [String(s.surah), r2PublicUrl(s.audioKey)])),
    })
  }
  return out
}

/** The ayah timings of a Listen qari's approved surah, as Listen and Read use them. */
export async function listenQariTimings(listenId: string, surah: number): Promise<Array<{ key: string; from: number; to: number }> | null> {
  if (!listenId.startsWith(LISTEN_QARI_PREFIX)) return null
  const reciter = await prisma.listenReciter.findFirst({ where: { slug: listenId.slice(LISTEN_QARI_PREFIX.length), published: true } })
  if (!reciter) return null
  const row = await prisma.listenSurah.findFirst({
    where: { reciterId: reciter.id, surah, status: 'approved' },
    orderBy: { approvedAt: 'desc' },
  })
  const timings = row?.timings as Record<string, [number, number]> | null | undefined
  if (!timings) return null
  return Object.entries(timings)
    .map(([key, [from, to]]) => ({ key, from, to }))
    .sort((a, b) => Number(a.key.split(':')[1]) - Number(b.key.split(':')[1]))
}
