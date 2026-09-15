import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { memberKeyFrom, trustedToday } from '@/lib/halaqa-server'

export const runtime = 'nodejs'

/**
 * POST /api/halaqa/read — "I read today", from the button or from reading in
 * the app. One record per person per day, counted in every halaqa they are in.
 */
export async function POST(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { today?: unknown; source?: unknown }
  const today = trustedToday(body.today)
  if (!today) return NextResponse.json({ error: "Your phone's date looks wrong." }, { status: 400 })
  const source = body.source === 'app' ? 'app' : 'manual'

  try {
    // Only people in a halaqa have reading days: nobody else could see them.
    const inHalaqa = await prisma.halaqaMember.findFirst({ where: { memberKey }, select: { id: true } })
    if (!inHalaqa) return NextResponse.json({ error: 'Join a halaqa first.' }, { status: 403 })

    const existing = await prisma.halaqaReadDay.findFirst({ where: { memberKey, day: today }, select: { id: true } })
    if (!existing) await prisma.halaqaReadDay.create({ data: { memberKey, day: today, source } })
    return NextResponse.json({ readToday: true })
  } catch (err) {
    console.error('[halaqa] read failed:', err)
    return NextResponse.json({ error: 'Could not save that right now.' }, { status: 500 })
  }
}
