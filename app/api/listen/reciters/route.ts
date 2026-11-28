import { NextResponse, type NextRequest } from 'next/server'
import type { ListenQarisResponse } from '@/lib/listen-qaris'
import { publicListenQaris } from '@/lib/listen-qaris-server'

export const runtime = 'nodejs'

/**
 * GET /api/listen/reciters — the verified qaris the admin has published in Listen, with the surahs
 * approved for them, and the viewer's country (Vercel's view of their connection), for the
 * "Local reciters" row.
 */
export async function GET(req: NextRequest) {
  const reciters = await publicListenQaris().catch(() => [])
  const country = req.headers.get('x-vercel-ip-country')?.trim().toUpperCase()
  const body: ListenQarisResponse = { reciters, ...(country && /^[A-Z]{2}$/.test(country) ? { country } : {}) }
  // The country is the viewer's own, so no shared cache may keep the answer.
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
