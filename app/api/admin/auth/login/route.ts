import { NextResponse } from 'next/server'
import {
  adminCredentialsConfigured,
  createAdminSessionToken,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from '@/lib/admin-auth-server'

export async function POST(req: Request) {
  if (!adminCredentialsConfigured()) {
    return NextResponse.json(
      { error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.' },
      { status: 503 }
    )
  }

  const body = (await req.json()) as { username?: string; password?: string }
  const username = body.username?.trim() ?? ''
  const password = body.password ?? ''

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: 'Wrong email or password.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  setAdminSessionCookie(res, createAdminSessionToken())
  return res
}
