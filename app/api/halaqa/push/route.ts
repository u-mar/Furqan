import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { memberKeyFrom } from '@/lib/halaqa-server'
import { isAppLanguage } from '@/lib/i18n-core'

export const runtime = 'nodejs'

interface Body {
  subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  endpoint?: string
  /** The language the phone uses Naba in, so reminders reach it in that language. */
  language?: string
}

/** POST /api/halaqa/push — this phone wants reminders for whichever halaqas it is in. */
export async function POST(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Body
  const endpoint = body.subscription?.endpoint
  const p256dh = body.subscription?.keys?.p256dh
  const auth = body.subscription?.keys?.auth
  // A browser's push address, or the Play Store app's Firebase one ("fcm:<token>", lib/push-client.ts).
  const app = /^fcm:[\w:-]{20,4096}$/.test(endpoint ?? '')
  if (!endpoint || (!app && (!p256dh || !auth || !/^https:\/\//.test(endpoint)))) {
    return NextResponse.json({ error: 'That is not a notification address.' }, { status: 400 })
  }

  try {
    // One row per phone: a phone used across accounts/halaqas moves it.
    await prisma.halaqaPushSubscription.deleteMany({ where: { endpoint } })
    await prisma.halaqaPushSubscription.create({
      data: {
        memberKey,
        endpoint,
        p256dh: p256dh ?? '',
        auth: auth ?? '',
        userAgent: (request.headers.get('user-agent') ?? '').slice(0, 200),
        language: isAppLanguage(body.language) ? body.language : 'en',
      },
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
