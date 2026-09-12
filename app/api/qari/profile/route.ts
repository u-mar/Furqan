import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

const MAX_NAME = 40

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
    }

    const username = (body.username || '').trim().toLowerCase()
    const userId = (body.userId || '').trim()
    const name = (body.name || '').trim().slice(0, MAX_NAME)

    if (!username || !userId) {
      return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Your name cannot be empty.' }, { status: 400 })
    }
    if (!(await ownsUsername(username, userId))) {
      return NextResponse.json({ error: 'That is not your profile.' }, { status: 403 })
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
