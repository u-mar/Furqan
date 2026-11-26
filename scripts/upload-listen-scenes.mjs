/**
 * Puts translation mode's still pictures on R2 under scenes/ (lib/listen-video.ts): for each, the
 * 1080 x 1920 picture and a 240 x 320 one for the picker.
 *
 *   node --env-file=.env.local scripts/upload-listen-scenes.mjs <folder of name.jpg and name-thumb.jpg>
 *
 * Phones keep these for a year: a changed picture goes up under a new name.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AwsClient } from 'aws4fetch'

const env = (name) => {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) throw new Error(`${name} is not set (run with --env-file=.env.local)`)
  return value
}

const folder = process.argv[2]
if (!folder) throw new Error('Name the folder the pictures are in.')

const r2 = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' })
const endpoint = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`
const publicUrl = env('R2_PUBLIC_URL').replace(/\/$/, '')

for (const name of (await readdir(folder)).filter((f) => f.endsWith('.jpg')).sort()) {
  const key = name.endsWith('-thumb.jpg') ? `scenes/thumbs/${name.replace('-thumb', '')}` : `scenes/${name}`
  const res = await r2.fetch(`${endpoint}/${key}`, {
    method: 'PUT',
    body: await readFile(join(folder, name)),
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
  if (!res.ok) throw new Error(`${key}: ${res.status} ${await res.text()}`)
  console.log('up', `${publicUrl}/${key}`)
}
