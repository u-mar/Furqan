import { GridFSBucket, MongoClient, ObjectId } from 'mongodb'
import { Readable } from 'node:stream'

/**
 * Audio storage for Qari recitations.
 *
 * Files live in GridFS on the same MongoDB the app already uses — no extra
 * service or credentials to configure. Prisma can't reach GridFS, so this is
 * the one place the raw driver is used; everything else stays on Prisma.
 *
 * The surface here is deliberately small (put / open / remove) so it can be
 * swapped for S3, R2 or Vercel Blob later without touching the API routes.
 */

export type QariBucket = 'qari_audio' | 'qari_avatars'

/** Recordings are short; anything larger is almost certainly a mistake. */
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024
export const MAX_DURATION_SEC = 600
/** Avatars are resized client-side before upload, so this is just a backstop. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024

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
      (bucketName === 'qari_avatars' ? 'image/jpeg' : 'audio/webm'),
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

/* Named wrappers keep the audio call sites reading clearly. */
export const putAudio = (data: Buffer, meta: { filename: string; mimeType: string }) =>
  putFile(data, { ...meta, bucket: 'qari_audio' })
export const openAudio = (audioId: string) => openFile(audioId, 'qari_audio')
export const removeAudio = (audioId: string) => removeFile(audioId, 'qari_audio')
