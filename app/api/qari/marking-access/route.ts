import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { ownsUsername } from '@/lib/qari-owner'

export const runtime = 'nodejs'

/** Long enough to send a long recording on a slow connection. */
const TOKEN_SECONDS = 15 * 60

/**
 * POST /api/qari/marking-access { username, userId } — a short-lived permission
 * for this account's phone to send a recording to the speech service
 * (services/nadir-asr), which marks its ayat. The recording goes straight
 * there, and the permission is signed here, so the service's key never reaches
 * a phone.
 */
export async function POST(request: NextRequest) {
  const url = process.env.ASR_URL?.trim().replace(/\/+$/, '')
  const key = process.env.ASR_API_KEY?.trim()
  if (!url || !key) {
    return NextResponse.json({ error: 'Marking is not set up.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as { username?: unknown; userId?: unknown } | null
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
  const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
  if (!(await ownsUsername(username, userId))) {
    return NextResponse.json({ error: 'Sign in to publish a recitation.' }, { status: 401 })
  }

  const expires = Math.floor(Date.now() / 1000) + TOKEN_SECONDS
  const signature = createHmac('sha256', key).update(`mark:${expires}`).digest('hex')
  return NextResponse.json({ url, token: `${expires}.${signature}` }, { headers: { 'Cache-Control': 'no-store' } })
}
