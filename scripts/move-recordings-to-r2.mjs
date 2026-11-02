/**
 * Moves Qari recordings out of the database (GridFS) into Cloudflare R2, where
 * the app plays them from (lib/r2.ts, lib/qari-storage.ts).
 *
 *   node --env-file=.env.local scripts/move-recordings-to-r2.mjs          # look only: what would move
 *   node --env-file=.env.local scripts/move-recordings-to-r2.mjs --go     # move them
 *   node --env-file=.env.local scripts/move-recordings-to-r2.mjs --go --limit 1   # just one, to try it
 *   node --env-file=.env.local scripts/move-recordings-to-r2.mjs --undo   # point them back at GridFS
 *
 * Needs DATABASE_URL and the R2_* keys. Each recording is uploaded, then fetched
 * back from its public address to check it arrived whole, and only then is the
 * recitation pointed at it. The GridFS copy is kept (its id saved as
 * `gridAudioId`), so --undo puts everything back as it was; the R2 copy is
 * remembered then (`r2AudioKey`), and a later --go uses it again instead of
 * uploading a second one.
 */
import { randomUUID } from 'node:crypto'
import { GridFSBucket, MongoClient, ObjectId } from 'mongodb'
import { AwsClient } from 'aws4fetch'

const go = process.argv.includes('--go')
const undo = process.argv.includes('--undo')
const limitAt = process.argv.indexOf('--limit')
const limit = limitAt > 0 ? Number(process.argv[limitAt + 1]) || 0 : 0

const env = (name) => {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) throw new Error(`${name} is not set (run with --env-file=.env.local)`)
  return value
}

const EXTENSIONS = { 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav' }

const mongo = new MongoClient(env('DATABASE_URL'), { serverSelectionTimeoutMS: 15000 })
await mongo.connect()
const db = mongo.db()
const recitations = db.collection('Recitation')

if (undo) {
  const moved = await recitations.find({ gridAudioId: { $exists: true } }).toArray()
  console.log(`${moved.length} recording(s) to point back at GridFS`)
  for (const r of moved) {
    await recitations.updateOne(
      { _id: r._id },
      { $set: { audioId: r.gridAudioId, r2AudioKey: r.audioId.replace(/^r2:/, '') }, $unset: { gridAudioId: '' } }
    )
  }
  console.log('Done. (The copies in R2 are left where they are.)')
  await mongo.close()
  process.exit(0)
}

// Only needed to move: looking needs the database alone.
const r2 = go ? new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' }) : null
const endpoint = go ? `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}` : ''
const publicUrl = go ? env('R2_PUBLIC_URL').replace(/\/$/, '') : ''
const gridfs = new GridFSBucket(db, { bucketName: 'qari_audio' })

const pending = await recitations
  .find({ audioId: { $type: 'string', $not: /^r2:/ } }, { projection: { audioId: 1, mimeType: 1, title: 1, userUsername: 1, r2AudioKey: 1 } })
  .limit(limit)
  .toArray()
console.log(`${pending.length} recording(s) still in the database${go ? '' : ' (looking only: add --go to move them)'}`)

let movedCount = 0
let failed = 0
for (const r of pending) {
  const label = `${r.userUsername ?? '?'} / ${r.title ?? r._id}`
  try {
    // Moved before and put back with --undo: its copy in R2 is still there.
    if (go && r.r2AudioKey) {
      const kept = await fetch(`${publicUrl}/${r.r2AudioKey}`, { method: 'HEAD' })
      if (kept.ok) {
        await recitations.updateOne({ _id: r._id }, { $set: { audioId: `r2:${r.r2AudioKey}`, gridAudioId: r.audioId }, $unset: { r2AudioKey: '' } })
        movedCount += 1
        console.log(`  moved ${label} (its copy was already in R2)`)
        continue
      }
    }
    const chunks = []
    for await (const chunk of gridfs.openDownloadStream(new ObjectId(r.audioId))) chunks.push(chunk)
    const data = Buffer.concat(chunks)
    const mimeType = r.mimeType || 'audio/webm'
    const key = `recitations/${randomUUID()}.${EXTENSIONS[mimeType] ?? 'webm'}`
    if (!go) {
      console.log(`  would move ${label} (${Math.round(data.length / 1024)} KB)`)
      continue
    }
    const put = await r2.fetch(`${endpoint}/${key}`, {
      method: 'PUT',
      body: new Uint8Array(data),
      headers: { 'Content-Type': mimeType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
    if (!put.ok) throw new Error(`upload refused (${put.status})`)
    // Fetched back from where the app will play it, before the recitation is pointed there.
    const check = await fetch(`${publicUrl}/${key}`, { method: 'HEAD' })
    if (!check.ok || Number(check.headers.get('content-length')) !== data.length) {
      throw new Error(`not readable at ${publicUrl}/${key} (${check.status})`)
    }
    await recitations.updateOne({ _id: r._id }, { $set: { audioId: `r2:${key}`, gridAudioId: r.audioId } })
    movedCount += 1
    console.log(`  moved ${label}`)
  } catch (err) {
    failed += 1
    console.log(`  could not move ${label}: ${err instanceof Error ? err.message : err}`)
  }
}

console.log(go ? `Moved ${movedCount}, failed ${failed}.` : 'Nothing was changed.')
await mongo.close()
