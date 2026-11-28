import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { serializeReciter } from '@/lib/listen-qaris-server'
import { prisma } from '@/lib/prisma'
import { verifyLinkedAccount } from '../verify-account'
import { r2Delete } from '@/lib/r2'
import { readFields } from '../fields'

export const runtime = 'nodejs'

async function find(id: string) {
  if (!/^[a-f0-9]{24}$/.test(id)) return null
  return prisma.listenReciter.findUnique({ where: { id } })
}

/** PATCH /api/admin/listen-qaris/:id — changes their details, or shows / hides them in Listen. */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const reciter = await find((await context.params).id)
  if (!reciter) return NextResponse.json({ error: 'No such qari.' }, { status: 404 })
  const fields = readFields((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if (typeof fields === 'string') return NextResponse.json({ error: fields }, { status: 400 })
  if (fields.username && !(await prisma.user.findUnique({ where: { username: fields.username }, select: { id: true } }))) {
    return NextResponse.json({ error: `No Qari account is called @${fields.username}.` }, { status: 404 })
  }
  const surahs = await prisma.listenSurah.findMany({ where: { reciterId: reciter.id } })
  if (fields.published && !surahs.some((s) => s.status === 'approved')) {
    return NextResponse.json({ error: 'Approve at least one surah first.' }, { status: 400 })
  }
  const row = await prisma.listenReciter.update({ where: { id: reciter.id }, data: fields })
  if (fields.username) await verifyLinkedAccount(fields.username)
  return NextResponse.json(serializeReciter(row, surahs))
}

/** DELETE /api/admin/listen-qaris/:id — removes the qari, their surahs and their files. */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const reciter = await find((await context.params).id)
  if (!reciter) return NextResponse.json({ error: 'No such qari.' }, { status: 404 })
  const surahs = await prisma.listenSurah.findMany({ where: { reciterId: reciter.id } })
  await prisma.listenSurah.deleteMany({ where: { reciterId: reciter.id } })
  await prisma.listenReciter.delete({ where: { id: reciter.id } })
  await Promise.all([...surahs.map((s) => r2Delete(s.audioKey)), reciter.photoKey ? r2Delete(reciter.photoKey) : null])
  return NextResponse.json({ ok: true })
}
