import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { r2Delete } from '@/lib/r2'
import { CLOUD_VIDEO_KEY_RE, cloudVideoFor, hasServiceKey } from '@/lib/qari-cloud-video'

/**
 * POST /api/qari/[id]/video — the cloud reporting a recitation's finished English video
 * (lib/qari-cloud-video). Only with the shared key. A video made for a background or title the
 * recitation no longer has is thrown away: a newer one is already being made.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasServiceKey(request.headers.get('x-api-key'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as { key?: unknown; madeFor?: unknown }
  const key = typeof body.key === 'string' ? body.key : ''
  if (!/^[a-f0-9]{24}$/i.test(id) || !CLOUD_VIDEO_KEY_RE.test(key) || !key.startsWith(`videos/en/${id}-`)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
  const recitation = await prisma.recitation.findUnique({ where: { id } })
  if (!recitation || body.madeFor !== cloudVideoFor(recitation)) {
    await r2Delete(key).catch(() => {})
    return NextResponse.json({ kept: false })
  }
  await prisma.recitation.update({ where: { id }, data: { videoKey: key } })
  if (recitation.videoKey && recitation.videoKey !== key) await r2Delete(recitation.videoKey).catch(() => {})
  return NextResponse.json({ kept: true })
}
