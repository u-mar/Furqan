import { createHash, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeEmail } from '@/lib/email-address'
import { hashPassword } from '@/lib/pin-hash'

export const runtime = 'nodejs'

/**
 * POST /api/auth/password/reset { email, token, password }
 *
 * Sets a new password from the link in a reset email, then signs the person
 * in. The link works once, and only until it expires.
 */
export async function POST(req: Request) {
  let body: { email?: string; token?: string; password?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const email = normalizeEmail(body.email)
  const token = typeof body.token === 'string' ? body.token : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8 || password.length > 128) {
    return NextResponse.json({ error: 'Use at least 8 characters for your password.' }, { status: 400 })
  }
  const expired = NextResponse.json(
    { error: 'This reset link has expired or was already used. Ask for a new one.' },
    { status: 400 }
  )
  if (!email || !token) return expired

  try {
    const user = await prisma.user.findFirst({ where: { email } })
    if (!user?.resetTokenHash || !user.resetTokenExpires || user.resetTokenExpires.getTime() < Date.now()) return expired
    const given = Buffer.from(createHash('sha256').update(token).digest('hex'))
    const stored = Buffer.from(user.resetTokenHash)
    if (given.length !== stored.length || !timingSafeEqual(given, stored)) return expired

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        resetTokenHash: null,
        resetTokenExpires: null,
        failedPins: 0,
        lockedUntil: null,
      },
    })
    return NextResponse.json({ user: { id: user.id, username: user.username, name: user.name, via: 'email' } })
  } catch (error) {
    console.error('[auth] password reset failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
