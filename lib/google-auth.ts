/**
 * "Continue with Google": the phone gets a signed token from Google (Google
 * Identity Services), the server asks Google whether it is genuine and meant
 * for this app, and only then trusts who it says the person is.
 *
 * Setup: create an OAuth client (type "Web application") in Google Cloud and
 * put its client id in NEXT_PUBLIC_GOOGLE_CLIENT_ID. Until then the button is
 * simply not shown, and username + PIN accounts work as before.
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
 * has expired, or was issued to some other app.
 */
export async function verifyGoogleCredential(credential: unknown): Promise<GoogleProfile | null> {
  const clientId = googleClientId()
  if (!clientId || typeof credential !== 'string' || credential.length > 4096) return null
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
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
  } catch {
    return null
  }
}
