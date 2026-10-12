import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword, verifyPin } from '@/lib/pin-hash'
import { EMAIL_RULE, normalizeEmail } from '@/lib/email-address'
import { isUsernameTaken, normalizeUsername, suggestUsername, USERNAME_RULE } from '@/lib/usernames'

export const runtime = 'nodejs'

const MIN_PASSWORD = 8
/** Wrong passwords in a row before the account waits a while. */
const MAX_ATTEMPTS = 8
const LOCK_MINUTES = 15

async function findByEmail(email: string) {
  return prisma.user.findFirst({ where: { email } })
}

/**
 * GET /api/auth/email?email= — whether an address already has an account, and
 * a username made from it for the "almost done" step.
 */
export async function GET(req: Request) {
  const email = normalizeEmail(new URL(req.url).searchParams.get('email'))
  if (!EMAIL_RULE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  try {
    // Both at once: each is a round trip to the database.
    const [existing, suggestion] = await Promise.all([findByEmail(email), suggestUsername(null, email)])
    return NextResponse.json(existing ? { taken: true } : { taken: false, suggestion })
  } catch {
    return NextResponse.json({ taken: null })
  }
}

interface Body {
  action?: 'signup' | 'login'
  email?: string
  /** Sign in: an email, or the username of an account made before emails. */
  identifier?: string
  password?: string
  name?: string
  username?: string
}

/**
 * POST /api/auth/email
 *
 * signup { email, password, name, username } — a new account.
 * login { identifier, password } — an email account, or an older one made with
 *   a username and 4-digit PIN, whose PIN now serves as its password.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const password = typeof body.password === 'string' ? body.password : ''

  try {
    if (body.action === 'signup') {
      const email = normalizeEmail(body.email)
      const name = (body.name ?? '').trim().slice(0, 40)
      const username = normalizeUsername(body.username ?? '')
      if (!EMAIL_RULE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
      if (password.length < MIN_PASSWORD || password.length > 128) {
        return NextResponse.json({ error: 'Use at least 8 characters for your password.' }, { status: 400 })
      }
      if (name.length < 2) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
      if (!USERNAME_RULE.test(username)) {
        return NextResponse.json({ error: 'Usernames are 3–20 letters, numbers or underscores.' }, { status: 400 })
      }
      if (await findByEmail(email)) {
        return NextResponse.json({ error: 'An account with this email already exists. Sign in instead.' }, { status: 409 })
      }
      if (await isUsernameTaken(username)) return NextResponse.json({ error: 'That username is taken.' }, { status: 409 })

      const created = await prisma.user.create({
        data: { username, name, email, passwordHash: await hashPassword(password), failedPins: 0 },
        select: { id: true, username: true, name: true },
      })
      return NextResponse.json({ user: { ...created, via: 'email' } }, { status: 201 })
    }

    const identifier = normalizeEmail(body.identifier)
    if (!identifier || !password) {
      return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 })
    }
    const user = identifier.includes('@')
      ? await findByEmail(identifier)
      : await prisma.user.findUnique({ where: { username: normalizeUsername(identifier) } })
    const wrong = identifier.includes('@') ? 'Wrong email or password.' : 'Wrong username or password.'
    if (!user) return NextResponse.json({ error: wrong }, { status: 401 })
    if (!user.passwordHash && !user.pinHash) {
      return NextResponse.json({ error: 'This account signs in with Google.' }, { status: 401 })
    }

    const now = Date.now()
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now) / 60000)
      return NextResponse.json(
        { error: `Too many wrong tries. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` },
        { status: 429 }
      )
    }

    // An older account's PIN is its password; a newer one has a real password.
    const ok = user.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyPin(password, user.pinHash as string)).ok
    if (!ok) {
      const failed = (user.failedPins ?? 0) + 1
      const lock = failed >= MAX_ATTEMPTS
      await prisma.user.update({
        where: { id: user.id },
        data: { failedPins: lock ? 0 : failed, lockedUntil: lock ? new Date(now + LOCK_MINUTES * 60000) : null },
      })
      if (lock) {
        return NextResponse.json({ error: `Too many wrong tries. Try again in ${LOCK_MINUTES} minutes.` }, { status: 429 })
      }
      return NextResponse.json({ error: wrong }, { status: 401 })
    }

    if (user.failedPins || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedPins: 0, lockedUntil: null } })
    }
    return NextResponse.json({
      user: { id: user.id, username: user.username, name: user.name, via: user.passwordHash ? 'email' : undefined },
    })
  } catch (error) {
    console.error('[auth] email sign-in failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
