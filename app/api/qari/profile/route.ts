import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

const MAX_NAME = 40
const MAX_BIO = 120

/** GET /api/qari/profile?username= — what a profile shows beyond its recitations: the bio. */
export async function GET(request: NextRequest) {
  const username = new URL(request.url).searchParams.get('username')?.trim().toLowerCase() ?? ''
  if (!username) return NextResponse.json({ bio: '' })
  try {
    const user = await prisma.user.findUnique({ where: { username }, select: { bio: true } })
    return NextResponse.json({ bio: user?.bio ?? '' })
  } catch {
    return NextResponse.json({ bio: '' })
  }
}

/**
 * PATCH /api/qari/profile — change the display name on a qari's profile.
 *
 * The handle itself never changes: it is how avatars, profiles and shared
 * links are addressed. Only the name shown above it is editable.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string
      userId?: string
      name?: string
      bio?: string
    }

    const username = (body.username || '').trim().toLowerCase()
    const userId = (body.userId || '').trim()
    const name = (body.name || '').trim().slice(0, MAX_NAME)

    if (!username || !userId) {
      return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    }
    if (!(await ownsUsername(username, userId))) {
      return NextResponse.json({ error: 'That is not your profile.' }, { status: 403 })
    }

    // The bio alone: one line of plain text, or empty to clear it. Kept on the account, so a
    // local-only one (which has no row here) cannot have one.
    if (typeof body.bio === 'string' && body.name === undefined) {
      const bio = body.bio.replace(/\s+/g, ' ').trim().slice(0, MAX_BIO)
      if (userId.startsWith('local_')) {
        return NextResponse.json({ error: 'Create an account to add a bio.' }, { status: 400 })
      }
      await prisma.user.update({ where: { username }, data: { bio: bio || null } })
      return NextResponse.json({ ok: true, bio })
    }
    if (!name) {
      return NextResponse.json({ error: 'Your name cannot be empty.' }, { status: 400 })
    }

    // Database-backed accounts carry the name on their User row. Local-only
    // accounts live in the browser, so there is nothing to update here — the
    // client rewrites its own copy either way.
    if (!userId.startsWith('local_')) {
      await prisma.user.update({ where: { username }, data: { name } }).catch(() => null)
    }

    // Recitations store the reciter's name alongside each recording, so past
    // recordings would keep the old name unless they are brought along.
    const { count } = await prisma.recitation.updateMany({
      where: { userUsername: username },
      data: { userName: name },
    })

    return NextResponse.json({ ok: true, name, recitationsUpdated: count })
  } catch (err) {
    console.error('[qari] rename failed:', err)
    return NextResponse.json({ error: 'Could not save that name.' }, { status: 500 })
  }
}
