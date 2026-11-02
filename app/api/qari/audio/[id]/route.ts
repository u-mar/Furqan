import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openAudio, r2AudioUrl } from '@/lib/qari-storage'

export const runtime = 'nodejs'

/**
 * GET /api/qari/audio/[id] — a recitation's audio: streamed from GridFS, or for
 * one kept in R2, a redirect to its own address (older links still work).
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const recitation = await prisma.recitation.findUnique({ where: { id } })
    if (!recitation || recitation.hidden) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const r2 = recitation.audioId ? r2AudioUrl(recitation.audioId) : null
    if (r2) {
      return NextResponse.redirect(r2, { status: 302, headers: { 'Cache-Control': 'public, max-age=86400' } })
    }
    const audio = recitation.audioId ? await openAudio(recitation.audioId) : null
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
