import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyGoogleCredential } from '@/lib/google-auth'
import { isUsernameTaken, normalizeUsername, suggestUsername, USERNAME_RULE } from '@/lib/usernames'

export const runtime = 'nodejs'

/**
 * POST /api/auth/google { credential, username?, name? }
 *
 * "Continue with Google". Someone who has signed in with Google before is
 * signed straight in. Someone new is asked for one thing first, the handle
 * their recitations go under — the reply carries a suggestion made from their
 * Google name — and the account is made when they send it back.
 */
export async function POST(req: Request) {
  let body: { credential?: unknown; username?: string; name?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const google = await verifyGoogleCredential(body.credential)
  if (!google) {
    return NextResponse.json({ error: 'Google sign-in did not go through. Please try again.' }, { status: 401 })
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { googleId: google.sub },
      select: { id: true, username: true, name: true },
    })
    if (existing) return NextResponse.json({ user: { ...existing, via: 'google' } })

    const name = (body.name?.trim() || google.name || '').slice(0, 40)
    const requested = normalizeUsername(body.username ?? '')

    // New here: ask for a handle, offering one made from their name.
    if (!requested) {
      return NextResponse.json({
        needsUsername: true,
        suggestion: await suggestUsername(google.name, google.email),
        name,
      })
    }

    if (!USERNAME_RULE.test(requested)) {
      return NextResponse.json({ error: 'Usernames are 3–20 letters, numbers or underscores.' }, { status: 400 })
    }
    if (name.length < 2) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
    }
    if (await isUsernameTaken(requested)) {
      return NextResponse.json({ error: 'That username is taken.' }, { status: 409 })
    }

    const created = await prisma.user.create({
      data: { username: requested, name, googleId: google.sub, email: google.email, failedPins: 0 },
      select: { id: true, username: true, name: true },
    })
    return NextResponse.json({ user: { ...created, via: 'google' } }, { status: 201 })
  } catch (error) {
    console.error('[auth] google sign-in failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
