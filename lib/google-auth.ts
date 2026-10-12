/**
 * "Continue with Google": the phone gets a signed token from Google (Google
 * Identity Services), the server asks Google whether it is genuine and meant
 * for this app, and only then trusts who it says the person is.
 *
 * Setup: create an OAuth client (type "Web application") in Google Cloud and
 * put its client id in NEXT_PUBLIC_GOOGLE_CLIENT_ID (with this site's address
 * under "Authorized JavaScript origins"). Until then the button says Google
 * sign-in isn't set up yet, and email accounts work as before.
 */

export interface GoogleProfile {
  /** Google's stable id for the person; never changes, unlike the email. */
  sub: string
  email: string | null
  name: string | null
}

export function googleClientId(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null
}

/**
 * The person a Google sign-in token belongs to, or null when it is not genuine,
 * has expired, or was issued to some other app. Takes either kind Google hands a
 * web app: an ID token (a signed JWT, from Google's own button) or an access
 * token (from its account-picker popup, which the app's own button opens).
 */
export async function verifyGoogleCredential(credential: unknown): Promise<GoogleProfile | null> {
  const clientId = googleClientId()
  if (!clientId || typeof credential !== 'string' || credential.length > 4096) return null
  try {
    return credential.startsWith('eyJ') ? await fromIdToken(credential, clientId) : await fromAccessToken(credential, clientId)
  } catch {
    return null
  }
}

async function fromIdToken(token: string, clientId: string): Promise<GoogleProfile | null> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const info = (await res.json()) as Record<string, string | undefined>
  const issuerOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com'
  const fresh = Number(info.exp) * 1000 > Date.now()
  if (info.aud !== clientId || !issuerOk || !fresh || !info.sub) return null
  return {
    sub: info.sub,
    email: info.email_verified === 'true' && info.email ? info.email.toLowerCase() : null,
    name: info.name?.trim() || null,
  }
}

async function fromAccessToken(token: string, clientId: string): Promise<GoogleProfile | null> {
  // First that the token was issued to this app, and is still good: a token
  // another app obtained must not be able to sign anyone in here.
  const check = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  if (!check.ok) return null
  const info = (await check.json()) as Record<string, string | undefined>
  if ((info.aud ?? info.azp) !== clientId || !(Number(info.expires_in) > 0)) return null

  // Then who it belongs to.
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const user = (await res.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string }
  if (!user.sub || (info.sub && info.sub !== user.sub)) return null
  return {
    sub: user.sub,
    email: user.email_verified && user.email ? user.email.toLowerCase() : null,
    name: user.name?.trim() || null,
  }
}
