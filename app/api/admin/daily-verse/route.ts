import { NextResponse } from 'next/server'
import {
  isAdminRequestAuthenticated,
  unauthorizedAdminResponse,
} from '@/lib/admin-auth-server'
import { prisma } from '@/lib/prisma'

const ADMIN_CONFIG_KEY = 'global'

export async function GET() {
  const config = await prisma.adminConfig.findUnique({ where: { key: ADMIN_CONFIG_KEY } })
  return NextResponse.json({
    verseKey: config?.dailyVerseKey ?? '2:152',
    surahName: config?.dailyVerseSurah ?? 'Al-Baqarah',
    label: config?.dailyVerseSurah ?? 'Al-Baqarah',
  })
}

export async function POST(req: Request) {
  if (!(await isAdminRequestAuthenticated(req))) {
    return unauthorizedAdminResponse()
  }

  const body = (await req.json()) as { verseKey?: string; surahName?: string }
  const verseKey = body.verseKey?.trim() ?? ''
  const surahName = body.surahName?.trim() ?? ''

  if (!/^\d+:\d+$/.test(verseKey)) {
    return NextResponse.json({ error: 'Verse key must look like 2:152.' }, { status: 400 })
  }

  const [surahPart] = verseKey.split(':')
  const nextSurah = surahName || `Surah ${surahPart}`

  const updated = await prisma.adminConfig.upsert({
    where: { key: ADMIN_CONFIG_KEY },
    update: { dailyVerseKey: verseKey, dailyVerseSurah: nextSurah },
    create: {
      key: ADMIN_CONFIG_KEY,
      dailyVerseKey: verseKey,
      dailyVerseSurah: nextSurah,
    },
  })

  return NextResponse.json({
    verseKey: updated.dailyVerseKey,
    surahName: updated.dailyVerseSurah,
    label: updated.dailyVerseSurah,
  })
}
