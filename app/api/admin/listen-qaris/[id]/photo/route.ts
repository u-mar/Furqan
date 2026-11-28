import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { photoKey, serializeReciter } from '@/lib/listen-qaris-server'
import { prisma } from '@/lib/prisma'
import { r2Delete, r2Put, r2Ready } from '@/lib/r2'

export const runtime = 'nodejs'

/** The admin page crops and shrinks the picture to a 512 px square JPEG first. */
const MAX_PHOTO_BYTES = 1024 * 1024

/** POST /api/admin/listen-qaris/:id/photo — their portrait (form field "photo", JPEG). */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  if (!r2Ready()) return NextResponse.json({ error: 'Storage is not set up.' }, { status: 503 })
  const id = (await context.params).id
  const reciter = /^[a-f0-9]{24}$/.test(id) ? await prisma.listenReciter.findUnique({ where: { id } }) : null
  if (!reciter) return NextResponse.json({ error: 'No such qari.' }, { status: 404 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof Blob) || file.type !== 'image/jpeg') return NextResponse.json({ error: 'Send a JPEG.' }, { status: 400 })
  if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'That picture is too large.' }, { status: 413 })

  const key = photoKey(reciter.slug)
  await r2Put(key, new Uint8Array(await file.arrayBuffer()), 'image/jpeg')
  const row = await prisma.listenReciter.update({ where: { id: reciter.id }, data: { photoKey: key } })
  if (reciter.photoKey) await r2Delete(reciter.photoKey)
  const surahs = await prisma.listenSurah.findMany({ where: { reciterId: reciter.id } })
  return NextResponse.json(serializeReciter(row, surahs))
}
