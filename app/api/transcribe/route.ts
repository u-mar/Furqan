import { NextRequest, NextResponse } from 'next/server'
import { transcribeWithRetry } from '@/lib/transcribe'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as File

    if (!audio) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const transcript = await transcribeWithRetry(audio)

    return NextResponse.json({ text: transcript })
  } catch (error) {
    const err = error as Error
    console.error('Transcription error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
