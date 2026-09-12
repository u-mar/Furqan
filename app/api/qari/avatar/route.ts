import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'
import { MAX_AVATAR_BYTES, putFile, removeFile } from '@/lib/qari-storage'

export const runtime = 'nodejs'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

/** POST /api/qari/avatar — set the signed-in user's profile picture. */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('image')
    const username = String(form.get('username') || '')
      .trim()
      .toLowerCase()
    const userId = String(form.get('userId') || '').trim()

    if (!username || !userId) {
      return NextResponse.json({ error: 'Sign in to set a picture.' }, { status: 401 })
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No image was attached.' }, { status: 400 })
    }
    if (!(await ownsUsername(username, userId))) {
      return NextResponse.json({ error: 'That is not your profile.' }, { status: 403 })
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ error: 'That image is too large.' }, { status: 413 })
    }

    const mimeType = (file.type || 'image/jpeg').split(';')[0]
    if (!ALLOWED_MIME.includes(mimeType)) {
      return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image.' }, { status: 415 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const imageId = await putFile(buffer, {
      filename: `${username}-avatar`,
      mimeType,
      bucket: 'qari_avatars',
    })

    const existing = await prisma.qariAvatar.findUnique({ where: { username } })
    await prisma.qariAvatar.upsert({
      where: { username },
      create: { username, imageId, mimeType },
      update: { imageId, mimeType },
    })

    // Drop the previous image only once the new one is safely recorded.
    if (existing?.imageId) await removeFile(existing.imageId, 'qari_avatars')

    return NextResponse.json({ ok: true, updatedAt: Date.now() })
  } catch (err) {
    console.error('[qari] avatar upload failed:', err)
    return NextResponse.json({ error: 'Could not save that picture.' }, { status: 500 })
  }
}

/** DELETE /api/qari/avatar?username=&userId= — remove it again. */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.trim().toLowerCase()
  const userId = searchParams.get('userId')?.trim()

  if (!username || !userId) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  }

  if (!(await ownsUsername(username, userId))) {
    return NextResponse.json({ error: 'That is not your profile.' }, { status: 403 })
  }

  try {
    const existing = await prisma.qariAvatar.findUnique({ where: { username } })
    if (existing) {
      await removeFile(existing.imageId, 'qari_avatars')
      await prisma.qariAvatar.delete({ where: { username } })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[qari] avatar delete failed:', err)
    return NextResponse.json({ error: 'Could not remove that picture.' }, { status: 500 })
  }
}
