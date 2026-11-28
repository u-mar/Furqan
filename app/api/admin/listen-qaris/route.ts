import { NextResponse } from 'next/server'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { freeSlug, refreshSurah, serializeReciter } from '@/lib/listen-qaris-server'
import { prisma } from '@/lib/prisma'
import { verifyLinkedAccount } from './verify-account'
import { readFields } from './fields'

export const runtime = 'nodejs'

/** GET /api/admin/listen-qaris — every Listen qari and their uploads, with each check's latest state. */
export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const reciters = await prisma.listenReciter.findMany({ orderBy: { createdAt: 'desc' }, take: 300 })
  const surahs = await prisma.listenSurah.findMany({ where: { reciterId: { in: reciters.map((r) => r.id) } } })
  const fresh = await Promise.all(surahs.map((s) => refreshSurah(s)))
  return NextResponse.json({
    reciters: reciters.map((r) => serializeReciter(r, fresh.filter((s) => s.reciterId === r.id))),
  })
}

/** POST /api/admin/listen-qaris { name, nameAr?, country, city?, qiraat, style, username? } — adds a qari, not yet in Listen. */
export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const fields = readFields({ qiraat: 'hafs', style: 'Murattal', ...body, published: false })
  if (typeof fields === 'string') return NextResponse.json({ error: fields }, { status: 400 })
  if (!fields.name || !fields.country) return NextResponse.json({ error: 'Enter a name and a country.' }, { status: 400 })
  if (fields.username && !(await prisma.user.findUnique({ where: { username: fields.username }, select: { id: true } }))) {
    return NextResponse.json({ error: `No Qari account is called @${fields.username}.` }, { status: 404 })
  }
  const row = await prisma.listenReciter.create({
    data: {
      slug: await freeSlug(fields.name),
      name: fields.name,
      nameAr: fields.nameAr ?? null,
      country: fields.country,
      city: fields.city ?? null,
      qiraat: fields.qiraat ?? 'hafs',
      style: fields.style ?? 'Murattal',
      username: fields.username ?? null,
      published: false,
    },
  })
  if (row.username) await verifyLinkedAccount(row.username)
  return NextResponse.json(serializeReciter(row, []))
}
