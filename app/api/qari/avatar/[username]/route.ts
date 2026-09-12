import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openFile } from '@/lib/qari-storage'

export const runtime = 'nodejs'

/**
 * GET /api/qari/avatar/[username] — stream a profile picture.
 *
 * 404 is the normal "no picture set" answer; the UI falls back to the
 * initial, so the client never has to ask whether one exists first.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params

  try {
    const record = await prisma.qariAvatar.findUnique({
      where: { username: decodeURIComponent(username).toLowerCase() },
    })
    if (!record) return new NextResponse(null, { status: 404 })

    const image = await openFile(record.imageId, 'qari_avatars')
    if (!image) return new NextResponse(null, { status: 404 })

    return new NextResponse(image.stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': String(image.length),
        // Short cache: a new picture should appear without a hard refresh.
        'Cache-Control': 'public, max-age=60, must-revalidate',
      },
    })
  } catch (err) {
    console.error('[qari] avatar fetch failed:', err)
    return new NextResponse(null, { status: 404 })
  }
}
