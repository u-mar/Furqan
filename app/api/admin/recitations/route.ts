import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { isAdminRequestAuthenticated, unauthorizedAdminResponse } from '@/lib/admin-auth-server'
import { removeRecitation } from '@/lib/admin-recitations'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const PAGE = 30

/**
 * GET /api/admin/recitations?q=&filter=all|public|private|reported&page= — Qari posts, newest
 * first: what each is, who posted it, how it is doing, and whether it is reported or hidden.
 */
export async function GET(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const params = new URL(req.url).searchParams
  const q = params.get('q')?.trim() ?? ''
  const filter = params.get('filter') ?? 'all'
  const page = Math.max(0, Number(params.get('page')) || 0)

  const reported = await prisma.recitationReport.findMany({ select: { recitationId: true } })
  const reportCount = new Map<string, number>()
  for (const r of reported) reportCount.set(r.recitationId, (reportCount.get(r.recitationId) ?? 0) + 1)

  const where: Prisma.RecitationWhereInput = {}
  const and: Prisma.RecitationWhereInput[] = []
  if (q) {
    const contains = { contains: q, mode: 'insensitive' as const }
    and.push({ OR: [{ title: contains }, { userName: contains }, { userUsername: contains }, { verseKey: { startsWith: q } }] })
  }
  if (filter === 'private') and.push({ isPrivate: true })
  if (filter === 'public') and.push({ NOT: { isPrivate: true } })
  if (filter === 'reported') and.push({ id: { in: [...reportCount.keys()] } })
  if (and.length) where.AND = and

  const [total, rows] = await Promise.all([
    prisma.recitation.count({ where }),
    prisma.recitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: page * PAGE,
      take: PAGE,
      select: {
        id: true,
        kind: true,
        title: true,
        userName: true,
        userUsername: true,
        verseKey: true,
        durationSec: true,
        isPrivate: true,
        likeCount: true,
        playCount: true,
        createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE,
    recitations: rows.map((r) => ({
      id: r.id,
      kind: r.kind === 'ayah' ? 'ayah card' : 'recitation',
      title: r.title || (r.verseKey ? `Ayah ${r.verseKey}` : 'Untitled'),
      userName: r.userName,
      userUsername: r.userUsername,
      durationSec: r.durationSec,
      isPrivate: r.isPrivate === true,
      likes: r.likeCount,
      plays: r.playCount,
      reports: reportCount.get(r.id) ?? 0,
      createdAt: r.createdAt.getTime(),
    })),
  })
}

/** POST /api/admin/recitations { id, action: "hide" | "show" | "remove" } */
export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) return unauthorizedAdminResponse()
  const { id, action } = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown }
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) return NextResponse.json({ error: 'Missing recitation.' }, { status: 400 })
  if (action === 'hide' || action === 'show') {
    await prisma.recitation.update({ where: { id }, data: { isPrivate: action === 'hide' } })
    return NextResponse.json({ ok: true })
  }
  if (action === 'remove') {
    await removeRecitation(id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
