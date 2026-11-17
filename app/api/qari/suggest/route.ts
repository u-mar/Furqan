import { NextRequest, NextResponse } from 'next/server'
import { blockedUsernamesFor } from '@/lib/qari-blocks-server'
import { suggestFor } from '@/lib/qari-search-server'

export const runtime = 'nodejs'

/** GET /api/qari/suggest?q=&viewerId= — what to offer while someone types in Qari's search. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const query = params.get('q')?.trim().slice(0, 60) ?? ''
  const viewerId = params.get('viewerId')?.trim() || undefined
  if (!query) return NextResponse.json({ qaris: [], terms: [] })
  try {
    const blocked = await blockedUsernamesFor(viewerId)
    return NextResponse.json(await suggestFor(query, blocked), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[qari] suggest failed:', err)
    return NextResponse.json({ qaris: [], terms: [] })
  }
}
