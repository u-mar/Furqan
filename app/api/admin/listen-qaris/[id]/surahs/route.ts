import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { startSurahUpload } from '@/lib/listen-qaris-server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * POST /api/admin/listen-qaris/:id/surahs { surah, fileName } — starts an upload: the admin's
 * browser then sends the file straight to the speech service with what this returns.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const id = (await context.params).id
  const reciter = /^[a-f0-9]{24}$/.test(id) ? await prisma.listenReciter.findUnique({ where: { id } }) : null
  if (!reciter) return NextResponse.json({ error: 'No such qari.' }, { status: 404 })
  const body = (await req.json().catch(() => ({}))) as { surah?: unknown; fileName?: unknown }
  const surah = Number(body.surah)
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return NextResponse.json({ error: 'Choose a surah (1–114).' }, { status: 400 })
  try {
    return NextResponse.json(await startSurahUpload(reciter, surah, String(body.fileName ?? '')))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not start the upload.' }, { status: 503 })
  }
}
