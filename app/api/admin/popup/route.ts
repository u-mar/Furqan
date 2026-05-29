import { NextResponse } from 'next/server'
import {
  isAdminRequestAuthenticated,
  unauthorizedAdminResponse,
} from '@/lib/admin-auth-server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = (searchParams.get('userId') || '').trim()
  if (!userId) return NextResponse.json({ popups: [] })

  const popups = await prisma.popupMessage.findMany({
    where: {
      OR: [{ targetUserId: 'all' }, { targetUserId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })

  const pending = popups.filter((p) => !p.dismissedBy.includes(userId))
  return NextResponse.json({
    popups: pending.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      targetUserId: p.targetUserId,
      createdAt: p.createdAt.getTime(),
      dismissedBy: p.dismissedBy,
      shownTo: [],
    })),
  })
}

export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) {
    return unauthorizedAdminResponse()
  }

  const body = (await req.json()) as {
    title?: string
    body?: string
    targetUserId?: string
  }
  const title = body.title?.trim() || 'Message'
  const messageBody = body.body?.trim() || ''
  const targetUserId = body.targetUserId?.trim() || 'all'

  if (!messageBody) {
    return NextResponse.json({ error: 'Popup body cannot be empty.' }, { status: 400 })
  }

  const popup = await prisma.popupMessage.create({
    data: {
      title,
      body: messageBody,
      targetUserId,
      dismissedBy: [],
    },
  })

  return NextResponse.json({
    id: popup.id,
    title: popup.title,
    body: popup.body,
    targetUserId: popup.targetUserId,
    createdAt: popup.createdAt.getTime(),
    dismissedBy: popup.dismissedBy,
    shownTo: [],
  })
}
