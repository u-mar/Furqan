import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openAudio } from '@/lib/qari-storage'

export const runtime = 'nodejs'

/** GET /api/qari/audio/[id] — stream a recitation's audio. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const recitation = await prisma.recitation.findUnique({ where: { id } })
    if (!recitation || recitation.hidden) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const audio = await openAudio(recitation.audioId)
    if (!audio) return NextResponse.json({ error: 'Audio missing' }, { status: 404 })

    return new NextResponse(audio.stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': audio.mimeType,
        'Content-Length': String(audio.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'none',
      },
    })
  } catch (err) {
    console.error('[qari] audio stream failed:', err)
    return NextResponse.json({ error: 'Could not load audio.' }, { status: 500 })
  }
}
