import { NextRequest, NextResponse } from 'next/server'
import type { Halaqa, HalaqaMember } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  HALAQA_NAME_MAX,
  JUZ_COUNT,
  addDays,
  cleanName,
  dayLine,
  daysBetween,
  deleteHalaqa,
  findMembership,
  isDay,
  isObjectId,
  latestKhatmah,
  memberKeyFrom,
  newInviteCode,
  readDaysFor,
  removeMember,
  serverDay,
  trustedToday,
} from '@/lib/halaqa-server'
import { sendHalaqaPush } from '@/lib/push'

export const runtime = 'nodejs'

const WINDOW_DAYS = 30
const SET_LENGTHS = new Set([7, 30, 40])

type Context = { params: Promise<{ id: string }> }

async function detail(halaqa: Halaqa, me: HalaqaMember, today: string) {
  // Independent lookups go out together: each one is a round trip to the database.
  const [members, currentKhatmah] = await Promise.all([
    prisma.halaqaMember.findMany({ where: { halaqaId: halaqa.id }, orderBy: { joinedAt: 'asc' } }),
    halaqa.khatmahEnabled ? latestKhatmah(halaqa.id) : Promise.resolve(null),
  ])
  const keys = [...new Set(members.map((m) => m.memberKey))]
  const ended = Boolean(halaqa.endDay && today > halaqa.endDay)

  const windowStart = addDays(today, -(WINDOW_DAYS - 1))
  const periodStart = halaqa.endDay ? halaqa.startDay : windowStart
  const periodEnd = halaqa.endDay && ended ? halaqa.endDay : today
  const readFrom = periodStart < windowStart ? periodStart : windowStart
  const [read, khatmahRows] = await Promise.all([
    readDaysFor(keys, readFrom, today),
    currentKhatmah ? prisma.halaqaJuz.findMany({ where: { khatmahId: currentKhatmah.id }, orderBy: { juz: 'asc' } }) : Promise.resolve([]),
  ])

  const people = members.map((m) => {
    const days = read.get(m.memberKey)
    return {
      id: m.id,
      name: m.name,
      isCreator: m.isCreator,
      isMe: m.id === me.id,
      joinedAt: m.joinedAt.toISOString(),
      readToday: Boolean(days?.has(today)),
      recent: dayLine(days, m.joinedAt, windowStart, today),
    }
  })

  let summary = null
  if (ended && halaqa.endDay) {
    const lines = members.map((m) => ({ id: m.id, ...dayLine(read.get(m.memberKey), m.joinedAt, periodStart, periodEnd) }))
    const total = daysBetween(periodStart, periodEnd) + 1
    let everyone = 0
    for (let i = 0; i < total; i += 1) {
      const present = lines.filter((line) => line.days[i] !== -1)
      if (present.length && present.every((line) => line.days[i] === 1)) everyone += 1
    }
    summary = { total, everyoneDays: everyone, lines }
  }

  let khatmah = null
  if (halaqa.khatmahEnabled) {
    const current = currentKhatmah
    if (current) {
      const rows = khatmahRows
      const names = new Map(members.map((m) => [m.id, m.name]))
      khatmah = {
        id: current.id,
        finishBy: current.finishBy ?? null,
        startedAt: current.startedAt.toISOString(),
        completedAt: current.completedAt ? current.completedAt.toISOString() : null,
        done: rows.filter((row) => row.doneAt).length,
        readers: new Set(rows.map((row) => row.memberId)).size,
        juz: rows.map((row) => ({
          juz: row.juz,
          done: Boolean(row.doneAt),
          memberId: row.memberId,
          memberName: names.get(row.memberId) ?? null,
          mine: row.memberId === me.id,
        })),
      }
    }
  }

  return {
    halaqa: {
      id: halaqa.id,
      name: halaqa.name,
      code: halaqa.code,
      startDay: halaqa.startDay,
      endDay: halaqa.endDay ?? null,
      khatmahEnabled: halaqa.khatmahEnabled,
      dayNumber: daysBetween(halaqa.startDay, today) + 1,
      ended,
    },
    me: { id: me.id, isCreator: me.isCreator, readToday: people.find((p) => p.isMe)?.readToday ?? false },
    members: people,
    khatmah,
    summary,
    windowDays: WINDOW_DAYS,
  }
}

async function caller(request: NextRequest, context: Context) {
  const memberKey = memberKeyFrom(request)
  if (!memberKey) return { error: NextResponse.json({ error: 'Missing halaqa key.' }, { status: 401 }) }
  const { id } = await context.params
  if (!isObjectId(id)) return { error: NextResponse.json({ error: 'Halaqa not found.' }, { status: 404 }) }
  const found = await findMembership(id, memberKey)
  if (!found) {
    return { error: NextResponse.json({ error: 'You are not in this halaqa.' }, { status: 404 }) }
  }
  return { memberKey, ...found }
}

/** GET /api/halaqa/[id]?today= — everything the halaqa's screens show. */
export async function GET(request: NextRequest, context: Context) {
  try {
    const who = await caller(request, context)
    if ('error' in who) return who.error
    const today = trustedToday(request.nextUrl.searchParams.get('today')) ?? serverDay()
    return NextResponse.json(await detail(who.halaqa, who.me, today))
  } catch (err) {
    console.error('[halaqa] detail failed:', err)
    return NextResponse.json({ error: 'Could not load this halaqa.' }, { status: 500 })
  }
}

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

/** POST /api/halaqa/[id] — { action, today, ... } */
export async function POST(request: NextRequest, context: Context) {
  try {
    const who = await caller(request, context)
    if ('error' in who) return who.error
    const { halaqa, me } = who
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const today = trustedToday(body.today) ?? serverDay()
    const action = typeof body.action === 'string' ? body.action : ''
    const creatorOnly = () => (me.isCreator ? null : fail('Only the person who made this halaqa can do that.', 403))

    switch (action) {
      case 'rename': {
        const denied = creatorOnly()
        if (denied) return denied
        const name = cleanName(body.name, HALAQA_NAME_MAX)
        if (!name) return fail('Give the halaqa a name.')
        await prisma.halaqa.update({ where: { id: halaqa.id }, data: { name } })
        break
      }

      case 'schedule': {
        const denied = creatorOnly()
        if (denied) return denied
        if (body.mode === 'every') {
          await prisma.halaqa.update({ where: { id: halaqa.id }, data: { endDay: null } })
        } else if (typeof body.length === 'number' && SET_LENGTHS.has(body.length)) {
          await prisma.halaqa.update({
            where: { id: halaqa.id },
            data: { startDay: today, endDay: addDays(today, body.length - 1) },
          })
        } else if (isDay(body.endDay)) {
          const span = daysBetween(today, body.endDay)
          if (span < 1 || span > 366) return fail('Pick an end date within the next year.')
          await prisma.halaqa.update({ where: { id: halaqa.id }, data: { startDay: today, endDay: body.endDay } })
        } else {
          return fail('Choose how long the halaqa runs.')
        }
        break
      }

      case 'run-again': {
        const denied = creatorOnly()
        if (denied) return denied
        if (!halaqa.endDay || today <= halaqa.endDay) return fail('This halaqa has not ended.')
        const length = daysBetween(halaqa.startDay, halaqa.endDay) + 1
        await prisma.halaqa.update({
          where: { id: halaqa.id },
          data: { startDay: today, endDay: addDays(today, length - 1) },
        })
        break
      }

      case 'new-code': {
        const denied = creatorOnly()
        if (denied) return denied
        await prisma.halaqa.update({ where: { id: halaqa.id }, data: { code: await newInviteCode() } })
        break
      }

      case 'khatmah': {
        const denied = creatorOnly()
        if (denied) return denied
        const enabled = body.enabled === true
        await prisma.halaqa.update({ where: { id: halaqa.id }, data: { khatmahEnabled: enabled } })
        if (enabled && !(await latestKhatmah(halaqa.id))) {
          await prisma.halaqaKhatmah.create({
            data: { halaqaId: halaqa.id, finishBy: halaqa.endDay ?? null, completedAt: null },
          })
        }
        break
      }

      case 'finish-by': {
        const denied = creatorOnly()
        if (denied) return denied
        const current = await latestKhatmah(halaqa.id)
        if (!current) return fail('There is no khatmah yet.')
        if (body.day !== null && !isDay(body.day)) return fail('Pick a date.')
        if (isDay(body.day) && daysBetween(today, body.day) < 0) return fail('That date has already passed.')
        await prisma.halaqaKhatmah.update({
          where: { id: current.id },
          data: { finishBy: isDay(body.day) ? body.day : null },
        })
        break
      }

      case 'new-khatmah': {
        const denied = creatorOnly()
        if (denied) return denied
        const current = await latestKhatmah(halaqa.id)
        if (current && !current.completedAt) return fail('Finish this khatmah first.')
        await prisma.halaqa.update({ where: { id: halaqa.id }, data: { khatmahEnabled: true } })
        await prisma.halaqaKhatmah.create({
          data: {
            halaqaId: halaqa.id,
            finishBy: halaqa.endDay && halaqa.endDay >= today ? halaqa.endDay : null,
            completedAt: null,
          },
        })
        break
      }

      case 'take':
      case 'give-back':
      case 'done':
      case 'free': {
        const juz = typeof body.juz === 'number' ? body.juz : 0
        if (!Number.isInteger(juz) || juz < 1 || juz > JUZ_COUNT) return fail('Pick a juz from 1 to 30.')
        if (!halaqa.khatmahEnabled) return fail('This halaqa is not reading a khatmah.')
        const current = await latestKhatmah(halaqa.id)
        if (!current || current.completedAt) return fail('This khatmah is already complete.')
        const held = await prisma.halaqaJuz.findFirst({ where: { khatmahId: current.id, juz } })

        if (action === 'take') {
          if (held) return fail(held.memberId === me.id ? 'That juz is already yours.' : 'Someone has already taken that juz.', 409)
          const created = await prisma.halaqaJuz.create({
            data: { khatmahId: current.id, juz, memberId: me.id, doneAt: null },
          })
          // Two people can tap the same juz at once; the first one keeps it.
          const rows = await prisma.halaqaJuz.findMany({
            where: { khatmahId: current.id, juz },
            orderBy: { takenAt: 'asc' },
            select: { id: true },
          })
          if (rows.length > 1 && rows[0].id !== created.id) {
            await prisma.halaqaJuz.delete({ where: { id: created.id } })
            return fail('Someone took that juz just before you.', 409)
          }
          break
        }

        if (!held) return fail('Nobody has taken that juz.', 409)
        if (action === 'free') {
          const denied = creatorOnly()
          if (denied) return denied
          if (held.doneAt) return fail('That juz is already read.')
          await prisma.halaqaJuz.delete({ where: { id: held.id } })
          break
        }
        if (held.memberId !== me.id) return fail('That juz is not yours.', 403)
        if (action === 'give-back') {
          if (held.doneAt) return fail('That juz is already read.')
          await prisma.halaqaJuz.delete({ where: { id: held.id } })
          break
        }
        // done
        if (!held.doneAt) await prisma.halaqaJuz.update({ where: { id: held.id }, data: { doneAt: new Date() } })
        const rows = await prisma.halaqaJuz.findMany({ where: { khatmahId: current.id }, select: { juz: true, doneAt: true } })
        const finished = new Set(rows.filter((row) => row.doneAt).map((row) => row.juz))
        if (finished.size >= JUZ_COUNT) {
          await prisma.halaqaKhatmah.update({ where: { id: current.id }, data: { completedAt: new Date() } })
        }
        break
      }

      case 'remind': {
        const others = await prisma.halaqaMember.findMany({
          where: { halaqaId: halaqa.id, id: { not: me.id } },
          select: { memberKey: true },
        })
        const keys = [...new Set(others.map((m) => m.memberKey))]
        const already = keys.length
          ? await prisma.halaqaReadDay.findMany({ where: { memberKey: { in: keys }, day: today }, select: { memberKey: true } })
          : []
        const readSet = new Set(already.map((row) => row.memberKey))
        const remindKeys = keys.filter((key) => !readSet.has(key))
        await sendHalaqaPush(remindKeys, {
          title: `${me.name} sent a reminder`,
          body: `Have you read today in ${halaqa.name}?`,
          url: `/halaqa/${halaqa.id}`,
          tag: `halaqa-remind-${halaqa.id}`,
        })
        return NextResponse.json({ ok: true, remindedCount: remindKeys.length })
      }

      case 'remove': {
        const denied = creatorOnly()
        if (denied) return denied
        if (!isObjectId(body.memberId) || body.memberId === me.id) return fail('Pick someone to remove.')
        const member = await prisma.halaqaMember.findUnique({ where: { id: body.memberId } })
        if (!member || member.halaqaId !== halaqa.id) return fail('That person is not in this halaqa.', 404)
        await removeMember(member)
        break
      }

      case 'leave': {
        if (me.isCreator) {
          const next = await prisma.halaqaMember.findFirst({
            where: { halaqaId: halaqa.id, id: { not: me.id } },
            orderBy: { joinedAt: 'asc' },
          })
          if (!next) {
            await deleteHalaqa(halaqa.id)
            return NextResponse.json({ ok: true, left: true })
          }
          // Someone has to be able to look after it: the longest-standing member.
          await prisma.halaqaMember.update({ where: { id: next.id }, data: { isCreator: true } })
        }
        await removeMember(me)
        return NextResponse.json({ ok: true, left: true })
      }

      default:
        return fail('Unknown action.')
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[halaqa] action failed:', err)
    return NextResponse.json({ error: 'Could not do that right now.' }, { status: 500 })
  }
}

/** DELETE /api/halaqa/[id] — the creator ends the halaqa for everyone. */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const who = await caller(request, context)
    if ('error' in who) return who.error
    if (!who.me.isCreator) return fail('Only the person who made this halaqa can delete it.', 403)
    await deleteHalaqa(who.halaqa.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[halaqa] delete failed:', err)
    return NextResponse.json({ error: 'Could not delete the halaqa right now.' }, { status: 500 })
  }
}
