import { NextRequest, NextResponse } from 'next/server'
import { ownsUsername } from '@/lib/qari-owner'
import { MAX_AUDIO_PIECE_BYTES, MAX_AUDIO_PIECES, putAudioPiece } from '@/lib/qari-storage'

export const runtime = 'nodejs'

const UPLOAD_ID = /^[0-9a-f-]{36}$/

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '')

/** POST /api/qari/audio-piece — one piece of a recording too large to send in one request (see lib/qari-storage.ts). */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const piece = form.get('piece')
    const uploadId = text(form.get('uploadId'))
    const index = Number(form.get('index'))
    const username = text(form.get('userUsername'))
    const userId = text(form.get('userId'))

    if (
      !(piece instanceof File) ||
      piece.size === 0 ||
      piece.size > MAX_AUDIO_PIECE_BYTES ||
      !UPLOAD_ID.test(uploadId) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= MAX_AUDIO_PIECES
    ) {
      return NextResponse.json({ error: 'That recording is too long to upload.' }, { status: 400 })
    }
    if (!(await ownsUsername(username, userId))) {
      return NextResponse.json({ error: 'Sign in to publish a recitation.' }, { status: 401 })
    }

    await putAudioPiece(Buffer.from(await piece.arrayBuffer()), username, uploadId, index)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[qari] audio piece failed:', err)
    return NextResponse.json({ error: 'Could not publish the recitation.' }, { status: 500 })
  }
}
