import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const body = (await req.json()) as { popupId?: string; userId?: string }
  const popupId = body.popupId?.trim() ?? ''
  const userId = body.userId?.trim() ?? ''

  if (!popupId || !userId) {
    return NextResponse.json({ error: 'Missing popupId or userId.' }, { status: 400 })
  }

  const popup = await prisma.popupMessage.findUnique({ where: { id: popupId } })
  if (!popup) {
    return NextResponse.json({ error: 'Popup not found.' }, { status: 404 })
  }
  if (popup.dismissedBy.includes(userId)) return NextResponse.json({ ok: true })

  await prisma.popupMessage.update({
    where: { id: popupId },
    data: { dismissedBy: [...popup.dismissedBy, userId] },
  })

  return NextResponse.json({ ok: true })
}
