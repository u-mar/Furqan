import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  JUZ_COUNT,
  MAX_MEMBERS,
  MAX_MEMBERSHIPS,
  MEMBER_NAME_MAX,
  cleanName,
  latestKhatmah,
  memberKeyFrom,
  serverDay,
  trustedToday,
} from '@/lib/halaqa-server'

export const runtime = 'nodejs'

function readCode(value: unknown): string {
  return typeof value === 'string' && /^[a-z0-9]{6,12}$/.test(value.trim().toLowerCase())
    ? value.trim().toLowerCase()
    : ''
}

/** GET /api/halaqa/join?code=&today= — what someone opening an invite sees before joining. */
export async function GET(request: NextRequest) {
  const code = readCode(request.nextUrl.searchParams.get('code'))
  if (!code) return NextResponse.json({ error: 'This invite link is not complete.' }, { status: 400 })
  const today = trustedToday(request.nextUrl.searchParams.get('today')) ?? serverDay()
  const memberKey = memberKeyFrom(request)

  try {
    const halaqa = await prisma.halaqa.findFirst({ where: { code } })
    if (!halaqa) return NextResponse.json({ error: 'This invite link no longer works.' }, { status: 404 })

    const members = await prisma.halaqaMember.findMany({
      where: { halaqaId: halaqa.id },
      orderBy: { joinedAt: 'asc' },
      select: { name: true, memberKey: true, isCreator: true },
    })
    const readers = await prisma.halaqaReadDay.findMany({
      where: { memberKey: { in: members.map((m) => m.memberKey) }, day: today },
      select: { memberKey: true },
    })
    const khatmah = halaqa.khatmahEnabled ? await latestKhatmah(halaqa.id) : null
    const done = khatmah
      ? (await prisma.halaqaJuz.findMany({ where: { khatmahId: khatmah.id }, select: { doneAt: true } })).filter(
          (row) => row.doneAt
        ).length
      : 0

    return NextResponse.json({
      id: halaqa.id,
      name: halaqa.name,
      creatorName: members.find((m) => m.isCreator)?.name ?? null,
      memberCount: members.length,
      initials: members.slice(0, 4).map((m) => m.name.charAt(0).toUpperCase()),
      readCount: new Set(readers.map((r) => r.memberKey)).size,
      endDay: halaqa.endDay ?? null,
      khatmah: khatmah ? { done, total: JUZ_COUNT } : null,
      isMember: Boolean(memberKey && members.some((m) => m.memberKey === memberKey)),
      full: members.length >= MAX_MEMBERS,
    })
  } catch (err) {
    console.error('[halaqa] invite preview failed:', err)
    return NextResponse.json({ error: 'Could not open this invite right now.' }, { status: 500 })
  }
}

/** POST /api/halaqa/join — join with a name. Joining twice just returns the halaqa. */
export async function POST(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; name?: unknown }
  const code = readCode(body.code)
  const name = cleanName(body.name, MEMBER_NAME_MAX)
  if (!code) return NextResponse.json({ error: 'This invite link is not complete.' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Add your name to join.' }, { status: 400 })

  try {
    const halaqa = await prisma.halaqa.findFirst({ where: { code } })
    if (!halaqa) return NextResponse.json({ error: 'This invite link no longer works.' }, { status: 404 })

    const existing = await prisma.halaqaMember.findFirst({ where: { halaqaId: halaqa.id, memberKey } })
    if (existing) return NextResponse.json({ id: halaqa.id })

    const [count, memberships] = await Promise.all([
      prisma.halaqaMember.count({ where: { halaqaId: halaqa.id } }),
      prisma.halaqaMember.count({ where: { memberKey } }),
    ])
    if (count >= MAX_MEMBERS) return NextResponse.json({ error: 'This halaqa is full.' }, { status: 400 })
    if (memberships >= MAX_MEMBERSHIPS) {
      return NextResponse.json({ error: 'You are in as many halaqas as one phone can be.' }, { status: 400 })
    }

    const created = await prisma.halaqaMember.create({ data: { halaqaId: halaqa.id, memberKey, name } })
    // No unique index here: if a double tap got in twice, keep the first.
    const rows = await prisma.halaqaMember.findMany({
      where: { halaqaId: halaqa.id, memberKey },
      orderBy: { joinedAt: 'asc' },
      select: { id: true },
    })
    if (rows.length > 1 && rows[0].id !== created.id) {
      await prisma.halaqaMember.delete({ where: { id: created.id } })
    }
    return NextResponse.json({ id: halaqa.id })
  } catch (err) {
    console.error('[halaqa] join failed:', err)
    return NextResponse.json({ error: 'Could not join right now.' }, { status: 500 })
  }
}
