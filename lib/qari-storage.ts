import { GridFSBucket, MongoClient, ObjectId } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { r2Delete, r2PublicUrl, r2Put, r2Ready } from '@/lib/r2'

/**
 * Audio storage for Qari recitations.
 *
 * Files live in GridFS on the same MongoDB the app already uses — no extra
 * service or credentials to configure. Prisma can't reach GridFS, so this is
 * the one place the raw driver is used; everything else stays on Prisma.
 *
 * The surface here is deliberately small (put / open / remove) so it can be
 * swapped for S3, R2 or Vercel Blob later without touching the API routes.
 *
 * Recordings now go to Cloudflare R2 where it is set up (lib/r2.ts), played
 * straight from there; their `audioId` is then "r2:<key>" instead of a GridFS
 * id. Older ones stay in GridFS until moved (scripts/move-recordings-to-r2.mjs).
 */

export type QariBucket = 'qari_audio' | 'qari_audio_pieces' | 'qari_avatars' | 'qari_images'

/** Recordings are short; anything larger is almost certainly a mistake. */
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024
export const MAX_DURATION_SEC = 600
/** Avatars are resized client-side before upload, so this is just a backstop. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
/** An ayah card is one 1080×1350 JPEG, usually well under a megabyte. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

const globalForMongo = globalThis as unknown as { qariMongo?: MongoClient }

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, '')
  if (!url) throw new Error('DATABASE_URL is not set')
  return url
}

async function client(): Promise<MongoClient> {
  if (globalForMongo.qariMongo) return globalForMongo.qariMongo
  const created = new MongoClient(databaseUrl(), { serverSelectionTimeoutMS: 15000 })
  await created.connect()
  globalForMongo.qariMongo = created
  return created
}

async function bucket(name: QariBucket = 'qari_audio'): Promise<GridFSBucket> {
  const conn = await client()
  return new GridFSBucket(conn.db(), { bucketName: name })
}

export async function putFile(
  data: Buffer,
  meta: { filename: string; mimeType: string; bucket?: QariBucket }
): Promise<string> {
  const gfs = await bucket(meta.bucket)
  return new Promise<string>((resolve, reject) => {
    // Driver v7 dropped `contentType` from GridFS options — it lives in metadata now.
    const upload = gfs.openUploadStream(meta.filename, {
      metadata: { mimeType: meta.mimeType },
    })
    Readable.from(data)
      .pipe(upload)
      .on('error', reject)
      .on('finish', () => resolve(String(upload.id)))
  })
}

export interface StoredAudio {
  stream: NodeJS.ReadableStream
  mimeType: string
  length: number
}

export async function openFile(
  fileId: string,
  bucketName: QariBucket = 'qari_audio'
): Promise<StoredAudio | null> {
  let id: ObjectId
  try {
    id = new ObjectId(fileId)
  } catch {
    return null
  }

  const gfs = await bucket(bucketName)
  const [file] = await gfs.find({ _id: id }).limit(1).toArray()
  if (!file) return null

  return {
    stream: gfs.openDownloadStream(id),
    mimeType:
      (file.metadata?.mimeType as string) ||
      (bucketName === 'qari_audio' ? 'audio/webm' : 'image/jpeg'),
    length: file.length,
  }
}

export async function removeFile(
  fileId: string,
  bucketName: QariBucket = 'qari_audio'
): Promise<void> {
  try {
    const gfs = await bucket(bucketName)
    await gfs.delete(new ObjectId(fileId))
  } catch {
    /* already gone — removing the owning row is what matters */
  }
}

/* ------------------------------------------------------------ recordings */

const R2_AUDIO = 'r2:'
const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
}

/** Whether this recording is kept in R2 (played from its own address) rather than GridFS. */
export function isR2Audio(audioId: string): boolean {
  return audioId.startsWith(R2_AUDIO)
}

/** The address an R2 recording is played from; null for one still in GridFS. */
export function r2AudioUrl(audioId: string): string | null {
  return isR2Audio(audioId) ? r2PublicUrl(audioId.slice(R2_AUDIO.length)) || null : null
}

/** Keeps a new recording: in R2 where it is set up, otherwise in GridFS. Returns its `audioId`. */
export async function putAudio(data: Buffer, meta: { filename: string; mimeType: string }): Promise<string> {
  if (!r2Ready()) return putFile(data, { ...meta, bucket: 'qari_audio' })
  // A random name: the address is public, so it must not be guessable.
  const key = `recitations/${randomUUID()}.${AUDIO_EXTENSIONS[meta.mimeType] ?? 'webm'}`
  await r2Put(key, data, meta.mimeType)
  return `${R2_AUDIO}${key}`
}

/** A GridFS recording to stream; null for an R2 one, which is fetched from its own address. */
export const openAudio = (audioId: string) => (isR2Audio(audioId) ? Promise.resolve(null) : openFile(audioId, 'qari_audio'))

export async function removeAudio(audioId: string): Promise<void> {
  if (isR2Audio(audioId)) await r2Delete(audioId.slice(R2_AUDIO.length))
  else await removeFile(audioId, 'qari_audio')
}

/* ------------------------------------------------------ recordings sent in pieces */

/**
 * The host refuses any request over about 4.5 MB, before this code runs, and a
 * recording can be 12 MB. A longer one is sent in pieces, kept here for the
 * moment it takes, and joined when it is posted (lib/qari.ts sends them).
 */
export const MAX_AUDIO_PIECE_BYTES = 4 * 1024 * 1024
export const MAX_AUDIO_PIECES = 4
/** The pieces of an upload nobody finished are cleared away after this. */
const AUDIO_PIECE_LIFETIME_MS = 60 * 60 * 1000

const pieceName = (owner: string, uploadId: string, index: number) => `${owner}/${uploadId}/${index}`

async function deleteMatching(gfs: GridFSBucket, filter: Record<string, unknown>): Promise<void> {
  const files = await gfs.find(filter).toArray()
  await Promise.all(files.map((file) => gfs.delete(file._id)))
}

export async function putAudioPiece(data: Buffer, owner: string, uploadId: string, index: number): Promise<void> {
  const gfs = await bucket('qari_audio_pieces')
  const filename = pieceName(owner, uploadId, index)
  await deleteMatching(gfs, { filename })
  await putFile(data, { filename, mimeType: 'application/octet-stream', bucket: 'qari_audio_pieces' })
  if (index === 0) await deleteMatching(gfs, { uploadDate: { $lt: new Date(Date.now() - AUDIO_PIECE_LIFETIME_MS) } })
}

/** The whole recording, or null if a piece of it never arrived. */
export async function joinAudioPieces(owner: string, uploadId: string, count: number): Promise<Buffer | null> {
  const gfs = await bucket('qari_audio_pieces')
  const parts: Buffer[] = []
  for (let index = 0; index < count; index++) {
    const [file] = await gfs.find({ filename: pieceName(owner, uploadId, index) }).limit(1).toArray()
    if (!file) return null
    const chunks: Buffer[] = []
    for await (const chunk of gfs.openDownloadStream(file._id)) chunks.push(chunk as Buffer)
    parts.push(Buffer.concat(chunks))
  }
  return Buffer.concat(parts)
}

export async function removeAudioPieces(owner: string, uploadId: string): Promise<void> {
  const filenames = Array.from({ length: MAX_AUDIO_PIECES }, (_, index) => pieceName(owner, uploadId, index))
  await deleteMatching(await bucket('qari_audio_pieces'), { filename: { $in: filenames } })
}

/* Named wrappers keep the image call sites reading clearly. */
export const putImage = (data: Buffer, meta: { filename: string; mimeType: string }) =>
  putFile(data, { ...meta, bucket: 'qari_images' })
export const openImage = (imageId: string) => openFile(imageId, 'qari_images')
export const removeImage = (imageId: string) => removeFile(imageId, 'qari_images')
