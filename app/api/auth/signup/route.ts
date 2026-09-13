import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, verifyPin } from '@/lib/pin-hash'

interface AuthPayload {
  action?: 'signup' | 'login'
  username?: string
  name?: string
  pin?: string
}

/** Wrong PINs allowed before the account is locked. */
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

const USERNAME_RULE = /^[a-z0-9_]{3,20}$/

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * A handle is taken if an account holds it — or if a local-only account has
 * already published under it. Those never reach the users table, so checking
 * accounts alone would let someone register the name and inherit another
 * person's recitations and picture.
 */
async function isUsernameTaken(username: string): Promise<boolean> {
  const [account, recitation, avatar] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.recitation.findFirst({ where: { userUsername: username }, select: { id: true } }),
    prisma.qariAvatar.findUnique({ where: { username }, select: { id: true } }),
  ])
  return Boolean(account || recitation || avatar)
}

/** GET /api/auth/signup?username= — live availability while choosing one. */
export async function GET(req: Request) {
  const username = normalizeUsername(new URL(req.url).searchParams.get('username') ?? '')
  if (!USERNAME_RULE.test(username)) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }
  try {
    return NextResponse.json({ available: !(await isUsernameTaken(username)) })
  } catch {
    // Unknown is not the same as taken; let the create step be the judge.
    return NextResponse.json({ available: null })
  }
}

export async function POST(req: Request) {
  let payload: AuthPayload
  try {
    payload = (await req.json()) as AuthPayload
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const action = payload.action === 'login' ? 'login' : 'signup'
  const username = normalizeUsername(payload.username ?? '')
  const pin = (payload.pin ?? '').trim()
  const name = (payload.name ?? '').trim().slice(0, 40)

  if (!USERNAME_RULE.test(username)) {
    return NextResponse.json(
      { error: 'Usernames are 3–20 letters, numbers or underscores.' },
      { status: 400 }
    )
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'Your PIN must be 4 digits.' }, { status: 400 })
  }

  try {
    if (action === 'signup') {
      if (name.length < 2) {
        return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 })
      }
      if (await isUsernameTaken(username)) {
        return NextResponse.json({ error: 'That username is taken.' }, { status: 409 })
      }

      const created = await prisma.user.create({
        data: { username, name, pinHash: await hashPin(pin), failedPins: 0 },
        select: { id: true, username: true, name: true },
      })
      return NextResponse.json({ user: created }, { status: 201 })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return NextResponse.json({ error: 'Wrong username or PIN.' }, { status: 401 })
    }

    const now = Date.now()
    if (user.lockedUntil && user.lockedUntil.getTime() > now) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - now) / 60000)
      return NextResponse.json(
        {
          error: `Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
          lockedMinutes: minutes,
        },
        { status: 429 }
      )
    }

    const { ok, needsUpgrade } = await verifyPin(pin, user.pinHash)

    if (!ok) {
      const failed = (user.failedPins ?? 0) + 1
      const lock = failed >= MAX_ATTEMPTS
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedPins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(now + LOCK_MINUTES * 60000) : null,
        },
      })
      if (lock) {
        return NextResponse.json(
          {
            error: `Too many wrong PINs. Try again in ${LOCK_MINUTES} minutes.`,
            lockedMinutes: LOCK_MINUTES,
          },
          { status: 429 }
        )
      }
      const left = MAX_ATTEMPTS - failed
      return NextResponse.json(
        {
          error: `Wrong username or PIN. ${left} attempt${left === 1 ? '' : 's'} left.`,
          attemptsLeft: left,
        },
        { status: 401 }
      )
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedPins: 0,
        lockedUntil: null,
        // Re-store an old unsalted hash now that the real PIN is in hand.
        ...(needsUpgrade ? { pinHash: await hashPin(pin) } : {}),
      },
    })

    return NextResponse.json({ user: { id: user.id, username: user.username, name: user.name } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('DATABASE_URL')) {
      return NextResponse.json({ error: 'Database is not configured.' }, { status: 500 })
    }
    console.error('[auth] failed:', error)
    // Internals stay in the server log, not in the app.
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
