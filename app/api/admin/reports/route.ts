import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { removeAudio } from '@/lib/qari-storage'

type Action = 'dismiss' | 'removeRecitation'

/**
 * POST /api/admin/reports
 * - `dismiss`: the report was looked at and needs no action — just drop that one row.
 * - `removeRecitation`: take the recording down — deletes the recitation itself
 *   (its audio, likes and every report against it), not only the report in front of you.
 */
export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) {
    return unauthorizedAdminResponse()
  }

  const body = (await req.json().catch(() => ({}))) as { action?: Action; reportId?: string; recitationId?: string }

  try {
    if (body.action === 'dismiss') {
      const reportId = body.reportId?.trim()
      if (!reportId) return NextResponse.json({ error: 'Missing reportId.' }, { status: 400 })
      await prisma.recitationReport.delete({ where: { id: reportId } }).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    if (body.action === 'removeRecitation') {
      const recitationId = body.recitationId?.trim()
      if (!recitationId) return NextResponse.json({ error: 'Missing recitationId.' }, { status: 400 })
      const recitation = await prisma.recitation.findUnique({ where: { id: recitationId } })
      if (recitation) {
        await removeAudio(recitation.audioId).catch(() => {})
        await prisma.recitationLike.deleteMany({ where: { recitationId } })
      }
      await prisma.recitationReport.deleteMany({ where: { recitationId } })
      await prisma.recitation.delete({ where: { id: recitationId } }).catch(() => {})
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('[admin] report action failed:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
