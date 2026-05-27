import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface AuthPayload {
  action?: 'signup' | 'login'
  username?: string
  name?: string
  pin?: string
}

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex')
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

export async function POST(req: Request) {
  try {
    let payload: AuthPayload
    try {
      payload = (await req.json()) as AuthPayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const action = payload.action === 'login' ? 'login' : 'signup'
    const username = normalizeUsername(payload.username ?? '')
    const pin = (payload.pin ?? '').trim()
    const name = (payload.name ?? '').trim()

    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-20 chars (letters, numbers, underscore).' },
        { status: 400 }
      )
    }
    if (!isValidPin(pin)) {
      return NextResponse.json({ error: 'PIN must be exactly 4 digits.' }, { status: 400 })
    }

    if (action === 'signup') {
      if (name.length < 2) {
        return NextResponse.json({ error: 'Name must be at least 2 characters.' }, { status: 400 })
      }
      const existing = await prisma.user.findUnique({ where: { username } })
      if (existing) {
        return NextResponse.json({ error: 'Username already exists.' }, { status: 409 })
      }

      const created = await prisma.user.create({
        data: { username, name, pinHash: hashPin(pin) },
        select: { id: true, username: true, name: true },
      })
      return NextResponse.json({ user: created }, { status: 201 })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || user.pinHash !== hashPin(pin)) {
      return NextResponse.json({ error: 'Invalid username or PIN.' }, { status: 401 })
    }

    return NextResponse.json(
      { user: { id: user.id, username: user.username, name: user.name } },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
