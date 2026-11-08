import { NextResponse } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { prisma } from '@/lib/prisma'

/** GET /api/admin/uploaders — the accounts allowed to post recordings made outside the app. */
export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const uploaders = await prisma.user.findMany({
    where: { canUpload: true },
    select: { username: true, name: true },
    orderBy: { username: 'asc' },
    take: 500,
  })
  return NextResponse.json({ uploaders })
}

/** POST /api/admin/uploaders { username, allowed } — turns it on or off for one account. */
export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; allowed?: unknown }
  const username = String(body.username ?? '').trim().replace(/^@/, '').toLowerCase()
  if (!username) return NextResponse.json({ error: 'Enter a username.' }, { status: 400 })

  const account = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  if (!account) return NextResponse.json({ error: `No account is called @${username}.` }, { status: 404 })

  const updated = await prisma.user.update({
    where: { id: account.id },
    data: { canUpload: body.allowed === true },
    select: { username: true, name: true, canUpload: true },
  })
  return NextResponse.json(updated)
}
