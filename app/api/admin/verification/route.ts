import { NextResponse } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { notifyVerification } from '@/lib/notify'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/verification — who has applied to be verified, oldest first, and who already is. */
export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const [requests, verified] = await Promise.all([
    prisma.user.findMany({
      where: { verifyRequestedAt: { not: null }, NOT: { verified: true } },
      select: { username: true, name: true, verifyNote: true, verifyRequestedAt: true },
      orderBy: { verifyRequestedAt: 'asc' },
      take: 200,
    }),
    prisma.user.findMany({
      where: { verified: true },
      select: { username: true, name: true },
      orderBy: { username: 'asc' },
      take: 500,
    }),
  ])
  return NextResponse.json({
    requests: requests.map((r) => ({
      username: r.username,
      name: r.name,
      note: r.verifyNote ?? '',
      requestedAt: r.verifyRequestedAt?.toISOString() ?? null,
    })),
    verified,
  })
}

/**
 * POST /api/admin/verification { username, verified } — verifies an account (from an application
 * or by @username), or takes the badge away. Either way the application is settled.
 */
export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; verified?: unknown }
  const username = String(body.username ?? '').trim().replace(/^@/, '').toLowerCase()
  if (!username) return NextResponse.json({ error: 'Enter a username.' }, { status: 400 })

  const account = await prisma.user.findUnique({
    where: { username },
    select: { id: true, verified: true, verifyRequestedAt: true },
  })
  if (!account) return NextResponse.json({ error: `No account is called @${username}.` }, { status: 404 })

  const verify = body.verified === true
  const updated = await prisma.user.update({
    where: { id: account.id },
    data: { verified: verify, verifyRequestedAt: null, verifyNote: null },
    select: { username: true, name: true, verified: true },
  })

  // The reciter is told the outcome: when the badge is newly theirs, or when their application
  // was declined. Taking a badge away later is not announced.
  if (verify && !account.verified) {
    await notifyVerification(updated.username, updated.name, true)
  } else if (!verify && !account.verified && account.verifyRequestedAt) {
    await notifyVerification(updated.username, updated.name, false)
  }
  return NextResponse.json(updated)
}
