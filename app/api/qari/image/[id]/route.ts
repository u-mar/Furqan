import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { openImage } from '@/lib/qari-storage'

export const runtime = 'nodejs'

/** GET /api/qari/image/[id] — the picture of an ayah card post. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params

  try {
    const post = await prisma.recitation.findUnique({ where: { id } })
    if (!post || post.hidden || !post.imageId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const image = await openImage(post.imageId)
    if (!image) return NextResponse.json({ error: 'Picture missing' }, { status: 404 })

    return new NextResponse(image.stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': String(image.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('[qari] image stream failed:', err)
    return NextResponse.json({ error: 'Could not load the picture.' }, { status: 500 })
  }
}
