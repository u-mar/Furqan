import { NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/lib/admin-auth-server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  clearAdminSessionCookie(res)
  return res
}
