import { createSign } from 'crypto'

/**
 * Sending a notification to the Play Store app, through Firebase Cloud
 * Messaging: its WebView has no web push, so the app saves its Firebase token
 * instead, as an "fcm:<token>" address (lib/push-client.ts), and lib/push.ts
 * hands those here.
 *
 * Key: FIREBASE_SERVICE_ACCOUNT, the whole JSON key of the Firebase project's
 * service account (Firebase console → Project settings → Service accounts →
 * Generate new private key). Without it nothing is sent and nothing breaks.
 */

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export interface FcmMessage {
  title: string
  body: string
  /** Where tapping it goes, inside the app. */
  url: string
  /** A newer message with the same tag replaces the older one on the phone. */
  tag?: string
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null
    // A key pasted with its line breaks written out as \n still works.
    return { ...(parsed as ServiceAccount), private_key: parsed.private_key.replace(/\\n/g, '\n') }
  } catch {
    return null
  }
}

export function canSendFcm(): boolean {
  return serviceAccount() !== null
}

let cached: { token: string; expires: number } | null = null

/** A short-lived Google access token, from a JWT the service account signs; kept until near its end. */
async function accessToken(account: ServiceAccount): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  const now = Math.floor(Date.now() / 1000)
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Google refused the service account (${res.status})`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

/**
 * Sends to one phone. 'gone' when Firebase says the token no longer belongs to
 * an app (removed, or its token replaced), so it can be forgotten.
 */
export async function sendFcm(token: string, message: FcmMessage): Promise<'sent' | 'gone' | 'failed'> {
  const account = serviceAccount()
  if (!account) return 'failed'
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(account)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body },
        data: { url: message.url },
        android: {
          ttl: '86400s',
          // The "Qari and halaqa" channel the app makes (components/NativeNotifications.tsx).
          notification: { channel_id: 'activity', ...(message.tag ? { tag: message.tag } : {}) },
        },
      },
    }),
    cache: 'no-store',
  })
  if (res.ok) return 'sent'
  const error = (await res.json().catch(() => null)) as { error?: { message?: string; details?: { errorCode?: string }[] } } | null
  const code = error?.error?.details?.find((d) => d.errorCode)?.errorCode
  // INVALID_ARGUMENT is also what a bad message gets: only a bad token makes it a phone to forget.
  const badToken = code === 'INVALID_ARGUMENT' && /registration token/i.test(error?.error?.message ?? '')
  if (res.status === 404 || code === 'UNREGISTERED' || badToken) return 'gone'
  console.error('[fcm] send failed:', res.status, code ?? '')
  return 'failed'
}
