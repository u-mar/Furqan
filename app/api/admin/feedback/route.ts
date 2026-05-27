import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    userId?: string
    userName?: string
    message?: string
    contact?: string
  }

  const userId = body.userId?.trim() ?? ''
  const userName = body.userName?.trim() ?? ''
  const message = body.message?.trim() ?? ''
  const contact = body.contact?.trim() ?? ''

  if (!userId || !userName || !message) {
    return NextResponse.json({ error: 'Missing required feedback fields.' }, { status: 400 })
  }

  const created = await prisma.feedbackMessage.create({
    data: { userId, userName, message, contact },
  })

  return NextResponse.json({
    id: created.id,
    userId: created.userId,
    userName: created.userName,
    message: created.message,
    contact: created.contact,
    createdAt: created.createdAt.getTime(),
  })
}
