/**
 * Puts the mushaf's V4 page fonts (made by scripts/make-qcf-v4.py) on R2 under qcf5/, where the
 * website loads them from (lib/qcf-font-cdn.ts).
 *
 *   node --env-file=.env.local scripts/upload-qcf-v4.mjs [folder]     (default: public/qcf)
 *
 * Phones keep these for a year: a changed font set goes up under a new folder (qcf6/ …), and
 * QCF_FONT_CDN_BASE moves to it.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AwsClient } from 'aws4fetch'

const FOLDER = 'qcf5'

const env = (name) => {
  const value = process.env[name]?.trim().replace(/^["']|["']$/g, '')
  if (!value) throw new Error(`${name} is not set (run with --env-file=.env.local)`)
  return value
}

const source = process.argv[2] || 'public/qcf'
const r2 = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' })
const endpoint = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`
const publicUrl = env('R2_PUBLIC_URL').replace(/\/$/, '')

let next = 1
let done = 0
async function worker() {
  while (next <= 604) {
    const page = next++
    const key = `${FOLDER}/p${page}.woff2`
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await r2.fetch(`${endpoint}/${key}`, {
          method: 'PUT',
          body: await readFile(join(source, `p${page}.woff2`)),
          headers: { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=31536000, immutable' },
        })
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
        break
      } catch (err) {
        if (attempt >= 3) throw new Error(`${key}: ${err.message}`)
      }
    }
    if (++done % 100 === 0) console.log(`${done}/604`)
  }
}
await Promise.all(Array.from({ length: 8 }, worker))
console.log(`604 fonts up at ${publicUrl}/${FOLDER}/`)
