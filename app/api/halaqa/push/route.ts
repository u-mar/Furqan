import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { memberKeyFrom } from '@/lib/halaqa-server'

export const runtime = 'nodejs'

interface Body {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  endpoint?: string
}

/** POST /api/halaqa/push — this phone wants reminders for whichever halaqas it is in. */
export async function POST(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Body
  const endpoint = body.subscription?.endpoint
  const p256dh = body.subscription?.keys?.p256dh
  const auth = body.subscription?.keys?.auth
  if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) {
    return NextResponse.json({ error: 'That is not a notification address.' }, { status: 400 })
  }

  try {
    // One row per phone: a phone used across accounts/halaqas moves it.
    await prisma.halaqaPushSubscription.deleteMany({ where: { endpoint } })
    await prisma.halaqaPushSubscription.create({
      data: { memberKey, endpoint, p256dh, auth, userAgent: (request.headers.get('user-agent') ?? '').slice(0, 200) },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push] halaqa subscribe failed:', err)
    return NextResponse.json({ error: 'Could not turn notifications on.' }, { status: 500 })
  }
}

/** DELETE /api/halaqa/push — this phone no longer wants them. */
export async function DELETE(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Body
  if (!body.endpoint) return NextResponse.json({ ok: true })
  try {
    await prisma.halaqaPushSubscription.deleteMany({ where: { endpoint: body.endpoint, memberKey } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push] halaqa unsubscribe failed:', err)
    return NextResponse.json({ error: 'Could not turn notifications off.' }, { status: 500 })
  }
}
