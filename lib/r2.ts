import { AwsClient } from 'aws4fetch'

/**
 * Cloudflare R2, where Qari recordings are kept: played straight from
 * Cloudflare, near the listener, instead of streamed out of the database.
 *
 * Keys: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (an R2 API
 * token with Object Read & Write on the bucket), R2_BUCKET (its name), and
 * R2_PUBLIC_URL (the domain connected to it, e.g. https://audio.qurannaba.com).
 * Until all are set, new recordings stay in the database as before.
 */

interface R2Config {
  client: AwsClient
  endpoint: string
  publicUrl: string
}

let cached: R2Config | null | undefined

function config(): R2Config | null {
  if (cached !== undefined) return cached
  const account = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  const publicUrl = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, '')
  cached =
    account && accessKeyId && secretAccessKey && bucket && publicUrl
      ? {
          client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
          endpoint: `https://${account}.r2.cloudflarestorage.com/${bucket}`,
          publicUrl,
        }
      : null
  return cached
}

export function r2Ready(): boolean {
  return config() !== null
}

/** Where anyone can fetch `key` from: the bucket's own domain. */
export function r2PublicUrl(key: string): string {
  const c = config()
  return c ? `${c.publicUrl}/${key}` : ''
}

export async function r2Put(key: string, data: Uint8Array, contentType: string): Promise<void> {
  const c = config()
  if (!c) throw new Error('R2 is not set up')
  // A copy on its own ArrayBuffer: what fetch takes as a body.
  const body = new Uint8Array(data)
  const signed = await c.client.sign(`${c.endpoint}/${key}`, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': contentType,
      // A recording never changes under its key: a new one gets a new key.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
  // Sent by hand rather than as the signed Request, whose body the server's fetch turns into a
  // stream with no stated length, which R2 refuses (411).
  const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body })
  if (!res.ok) throw new Error(`R2 refused the upload (${res.status})`)
}

export async function r2Delete(key: string): Promise<void> {
  const c = config()
  if (!c) return
  await c.client.fetch(`${c.endpoint}/${key}`, { method: 'DELETE' }).catch(() => {})
}
