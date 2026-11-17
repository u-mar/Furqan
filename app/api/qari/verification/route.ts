import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

const MAX_NOTE = 500

/** Where your own application stands. Only the owner may ask: whether someone applied is theirs to know. */
export type VerificationState = 'verified' | 'requested' | 'none'

/** GET /api/qari/verification?username=&userId= — whether you are verified, have applied, or neither. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const username = params.get('username')?.trim().toLowerCase() ?? ''
  const userId = params.get('userId')?.trim() ?? ''
  const headers = { 'Cache-Control': 'no-store' }
  if (!username || !userId || !(await ownsUsername(username, userId))) {
    return NextResponse.json({ state: 'none' satisfies VerificationState }, { headers })
  }
  try {
    const user = await prisma.user.findUnique({ where: { username }, select: { verified: true, verifyRequestedAt: true } })
    const state: VerificationState = user?.verified ? 'verified' : user?.verifyRequestedAt ? 'requested' : 'none'
    return NextResponse.json({ state }, { headers })
  } catch {
    return NextResponse.json({ state: 'none' satisfies VerificationState }, { headers })
  }
}

/**
 * POST /api/qari/verification { username, userId, note } — applies to be verified. The admin
 * sees it in the panel and decides; applying again only updates what was written.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; userId?: unknown; note?: unknown }
  const username = String(body.username ?? '').trim().toLowerCase()
  const userId = String(body.userId ?? '').trim()
  const note = String(body.note ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE)

  if (!username || !userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  // A local-only account has no row for the admin to look at, or to mark.
  if (userId.startsWith('local_')) {
    return NextResponse.json({ error: 'Create an account to apply.' }, { status: 400 })
  }
  if (!(await ownsUsername(username, userId))) {
    return NextResponse.json({ error: 'That is not your profile.' }, { status: 403 })
  }
  if (!note) return NextResponse.json({ error: 'Tell us a little about your recitation.' }, { status: 400 })

  try {
    const user = await prisma.user.findUnique({ where: { username }, select: { verified: true } })
    if (user?.verified) return NextResponse.json({ state: 'verified' satisfies VerificationState })
    await prisma.user.update({ where: { username }, data: { verifyRequestedAt: new Date(), verifyNote: note } })
    return NextResponse.json({ state: 'requested' satisfies VerificationState })
  } catch (err) {
    console.error('[qari] verification request failed:', err)
    return NextResponse.json({ error: 'Could not send that. Try again.' }, { status: 500 })
  }
}
