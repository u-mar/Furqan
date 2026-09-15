import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  HALAQA_NAME_MAX,
  JUZ_COUNT,
  MAX_MEMBERSHIPS,
  MEMBER_NAME_MAX,
  addDays,
  cleanName,
  daysBetween,
  isDay,
  memberKeyFrom,
  newInviteCode,
  serverDay,
  trustedToday,
} from '@/lib/halaqa-server'

export const runtime = 'nodejs'

const SET_LENGTHS = new Set([7, 30, 40])

/** GET /api/halaqa?today=YYYY-MM-DD — the halaqas this phone is in, and whether it read today. */
export async function GET(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })
  const today = trustedToday(request.nextUrl.searchParams.get('today')) ?? serverDay()

  try {
    const [memberships, mine] = await Promise.all([
      prisma.halaqaMember.findMany({ where: { memberKey }, orderBy: { joinedAt: 'asc' } }),
      prisma.halaqaReadDay.findFirst({ where: { memberKey, day: today }, select: { id: true } }),
    ])
    if (!memberships.length) return NextResponse.json({ readToday: Boolean(mine), halaqas: [] })

    const ids = memberships.map((m) => m.halaqaId)
    const [halaqas, members, khatmahs] = await Promise.all([
      prisma.halaqa.findMany({ where: { id: { in: ids } } }),
      prisma.halaqaMember.findMany({ where: { halaqaId: { in: ids } }, select: { halaqaId: true, memberKey: true } }),
      prisma.halaqaKhatmah.findMany({ where: { halaqaId: { in: ids } }, orderBy: { startedAt: 'desc' } }),
    ])

    const readers = new Set(
      (
        await prisma.halaqaReadDay.findMany({
          where: { memberKey: { in: [...new Set(members.map((m) => m.memberKey))] }, day: today },
          select: { memberKey: true },
        })
      ).map((row) => row.memberKey)
    )

    const latest = new Map<string, (typeof khatmahs)[number]>()
    for (const khatmah of khatmahs) if (!latest.has(khatmah.halaqaId)) latest.set(khatmah.halaqaId, khatmah)
    const juzRows = latest.size
      ? await prisma.halaqaJuz.findMany({
          where: { khatmahId: { in: [...latest.values()].map((k) => k.id) } },
          select: { khatmahId: true, doneAt: true },
        })
      : []

    const byId = new Map(halaqas.map((h) => [h.id, h]))
    const list = memberships
      .map((membership) => {
        const halaqa = byId.get(membership.halaqaId)
        if (!halaqa) return null
        const people = members.filter((m) => m.halaqaId === halaqa.id)
        const khatmah = halaqa.khatmahEnabled ? latest.get(halaqa.id) : undefined
        return {
          id: halaqa.id,
          name: halaqa.name,
          memberCount: people.length,
          readCount: people.filter((m) => readers.has(m.memberKey)).length,
          startDay: halaqa.startDay,
          endDay: halaqa.endDay ?? null,
          dayNumber: daysBetween(halaqa.startDay, today) + 1,
          khatmah: khatmah
            ? {
                done: juzRows.filter((row) => row.khatmahId === khatmah.id && row.doneAt).length,
                total: JUZ_COUNT,
                completed: Boolean(khatmah.completedAt),
              }
            : null,
        }
      })
      .filter(Boolean)

    return NextResponse.json({ readToday: Boolean(mine), halaqas: list })
  } catch (err) {
    console.error('[halaqa] list failed:', err)
    return NextResponse.json({ error: 'Could not load your halaqas.' }, { status: 500 })
  }
}

/** POST /api/halaqa — start a halaqa, with the caller as its creator. */
export async function POST(request: NextRequest) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown
    memberName?: unknown
    today?: unknown
    length?: unknown
    endDay?: unknown
    khatmah?: unknown
    finishBy?: unknown
  }
  const name = cleanName(body.name, HALAQA_NAME_MAX)
  const memberName = cleanName(body.memberName, MEMBER_NAME_MAX)
  const today = trustedToday(body.today)
  if (!name) return NextResponse.json({ error: 'Give the halaqa a name.' }, { status: 400 })
  if (!memberName) return NextResponse.json({ error: 'Add your name.' }, { status: 400 })
  if (!today) return NextResponse.json({ error: "Your phone's date looks wrong." }, { status: 400 })

  let endDay: string | null = null
  if (typeof body.length === 'number' && SET_LENGTHS.has(body.length)) {
    endDay = addDays(today, body.length - 1)
  } else if (isDay(body.endDay)) {
    const span = daysBetween(today, body.endDay)
    if (span < 1 || span > 366) {
      return NextResponse.json({ error: 'Pick an end date within the next year.' }, { status: 400 })
    }
    endDay = body.endDay
  }

  let finishBy: string | null = null
  if (isDay(body.finishBy)) {
    if (daysBetween(today, body.finishBy) < 0) {
      return NextResponse.json({ error: 'The khatmah date has already passed.' }, { status: 400 })
    }
    finishBy = body.finishBy
  } else if (body.khatmah === true) {
    finishBy = endDay
  }

  try {
    const memberships = await prisma.halaqaMember.count({ where: { memberKey } })
    if (memberships >= MAX_MEMBERSHIPS) {
      return NextResponse.json({ error: 'You are in as many halaqas as one phone can be.' }, { status: 400 })
    }

    const halaqa = await prisma.halaqa.create({
      data: {
        name,
        code: await newInviteCode(),
        startDay: today,
        endDay,
        khatmahEnabled: body.khatmah === true,
      },
    })
    await prisma.halaqaMember.create({
      data: { halaqaId: halaqa.id, memberKey, name: memberName, isCreator: true },
    })
    if (body.khatmah === true) {
      await prisma.halaqaKhatmah.create({ data: { halaqaId: halaqa.id, finishBy, completedAt: null } })
    }
    return NextResponse.json({ id: halaqa.id, code: halaqa.code })
  } catch (err) {
    console.error('[halaqa] create failed:', err)
    return NextResponse.json({ error: 'Could not start the halaqa right now.' }, { status: 500 })
  }
}
