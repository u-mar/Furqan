/**
 * Puts Nature mode's loops on R2, where Listen plays them from (lib/nature-sounds.ts).
 *
 *   node --env-file=.env.local scripts/upload-nature-sounds.mjs <folder of rain.mp3, waves.mp3, …>
 *
 * Each loop's first and last 6 seconds are baked fades (the player overlaps two copies there).
 * A changed loop goes up under a new version folder, and NATURE_VERSION moves to it, since
 * phones keep these for a year.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AwsClient } from 'aws4fetch'

const VERSION = 'v1'

const env = (name) => {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) throw new Error(`${name} is not set (run with --env-file=.env.local)`)
  return value
}

const folder = process.argv[2]
if (!folder) throw new Error('Name the folder the loops are in.')

const r2 = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' })
const endpoint = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`
const publicUrl = env('R2_PUBLIC_URL').replace(/\/$/, '')

for (const name of (await readdir(folder)).filter((f) => f.endsWith('.mp3')).sort()) {
  const key = `nature/${VERSION}/${name}`
  const res = await r2.fetch(`${endpoint}/${key}`, {
    method: 'PUT',
    body: await readFile(join(folder, name)),
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
  if (!res.ok) throw new Error(`${key}: ${res.status} ${await res.text()}`)
  console.log('up', `${publicUrl}/${key}`)
}
