import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

interface Body {
  username?: string
  userId?: string
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  endpoint?: string
}

async function caller(body: Body) {
  const username = body.username?.trim().toLowerCase() ?? ''
  const userId = body.userId?.trim() ?? ''
  if (!username || !userId) return null
  return (await ownsUsername(username, userId)) ? username : null
}

/** POST /api/qari/push — this phone wants notifications for this account. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body
  const username = await caller(body)
  if (!username) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const endpoint = body.subscription?.endpoint
  const p256dh = body.subscription?.keys?.p256dh
  const auth = body.subscription?.keys?.auth
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ error: 'That is not a notification address.' }, { status: 400 })
  }

  try {
    // One row per phone: signing in as someone else on the same phone moves it.
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })
    await prisma.pushSubscription.create({
      data: { username, endpoint, p256dh, auth, userAgent: (request.headers.get('user-agent') ?? '').slice(0, 200) },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push] subscribe failed:', err)
    return NextResponse.json({ error: 'Could not turn notifications on.' }, { status: 500 })
  }
}

/** DELETE /api/qari/push — this phone no longer wants them. */
export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body
  const username = await caller(body)
  if (!username) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  if (!body.endpoint) return NextResponse.json({ ok: true })
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, username } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push] unsubscribe failed:', err)
    return NextResponse.json({ error: 'Could not turn notifications off.' }, { status: 500 })
  }
}
