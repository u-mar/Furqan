import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { approveSurah, refreshSurah, removeSurah, serializeSurah } from '@/lib/listen-qaris-server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

async function find(id: string) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null
  return prisma.listenSurah.findUnique({ where: { id } })
}

/** GET /api/admin/listen-qaris/surahs/:surahId — the upload, with how far its check has got. */
export async function GET(req: NextRequest, context: { params: Promise<{ surahId: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const row = await find((await context.params).surahId)
  if (!row) return NextResponse.json({ error: 'No such upload.' }, { status: 404 })
  return NextResponse.json(serializeSurah(await refreshSurah(row)))
}

/**
 * POST …/:surahId { action: "approve" | "reject" | "failed", error? } — the admin's decision, or the
 * admin's browser saying the file never got through to the check.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ surahId: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const row = await find((await context.params).surahId)
  if (!row) return NextResponse.json({ error: 'No such upload.' }, { status: 404 })
  const { action, error } = (await req.json().catch(() => ({}))) as { action?: unknown; error?: unknown }
  if (action === 'approve') {
    if (row.status !== 'checked' && row.status !== 'rejected') {
      return NextResponse.json({ error: 'Wait for the check to finish.' }, { status: 409 })
    }
    return NextResponse.json(serializeSurah(await approveSurah(row)))
  }
  if (action === 'reject') {
    if (row.status !== 'checked' && row.status !== 'approved') return NextResponse.json({ error: 'Nothing to reject yet.' }, { status: 409 })
    return NextResponse.json(serializeSurah(await prisma.listenSurah.update({ where: { id: row.id }, data: { status: 'rejected' } })))
  }
  if (action === 'failed' && row.status === 'uploading') {
    const message = String(error ?? '').slice(0, 300) || 'The upload did not get through.'
    return NextResponse.json(serializeSurah(await prisma.listenSurah.update({ where: { id: row.id }, data: { status: 'failed', error: message } })))
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}

/** DELETE …/:surahId — removes the upload and its file. */
export async function DELETE(req: NextRequest, context: { params: Promise<{ surahId: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const row = await find((await context.params).surahId)
  if (!row) return NextResponse.json({ error: 'No such upload.' }, { status: 404 })
  await removeSurah(row)
  return NextResponse.json({ ok: true })
}
