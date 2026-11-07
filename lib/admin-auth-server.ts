import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const ADMIN_SESSION_COOKIE = 'muyassar_admin_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

function sessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim()
  if (!secret) return 'muyassar-dev-admin-secret-change-me'
  return secret
}

/** The admin's email: ADMIN_EMAIL, or the older ADMIN_USERNAME. Compared without regard to case. */
function adminEmail(): string {
  return (process.env.ADMIN_EMAIL?.trim() || process.env.ADMIN_USERNAME?.trim() || '').toLowerCase()
}

export function adminCredentialsConfigured(): boolean {
  return Boolean(adminEmail() && process.env.ADMIN_PASSWORD?.trim())
}

/** Same length digests, compared in constant time, so the password cannot be guessed from timing. */
function sameSecret(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const expectedEmail = adminEmail()
  const expectedPass = process.env.ADMIN_PASSWORD?.trim() ?? ''
  if (!expectedEmail || !expectedPass) return false
  const emailOk = sameSecret(email.trim().toLowerCase(), expectedEmail)
  const passOk = sameSecret(password, expectedPass)
  return emailOk && passOk
}

export function createAdminSessionToken(): string {
  const exp = Date.now() + SESSION_MS
  const payload = `admin:${exp}`
  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  return `${payload}.${sig}`
}

export function verifyAdminSessionToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('hex')
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length) return false
    if (!timingSafeEqual(a, b)) return false
  } catch {
    return false
  }
  const exp = Number(payload.split(':')[1])
  return Number.isFinite(exp) && Date.now() < exp
}

export function adminSessionCookieOptions(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_MS / 1000),
  }
}

export function setAdminSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions())
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', { ...adminSessionCookieOptions(), maxAge: 0 })
}

export async function isAdminRequestAuthenticated(req: Request): Promise<boolean> {
  const header = req.headers.get('cookie') ?? ''
  const match = header.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`))
  const token = match?.[1] ? decodeURIComponent(match[1]) : undefined
  return verifyAdminSessionToken(token)
}

export async function isAdminCookieAuthenticated(): Promise<boolean> {
  const jar = await cookies()
  return verifyAdminSessionToken(jar.get(ADMIN_SESSION_COOKIE)?.value)
}

export function unauthorizedAdminResponse(): NextResponse {
  return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 })
}
