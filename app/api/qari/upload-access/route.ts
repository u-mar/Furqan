import { NextRequest, NextResponse } from 'next/server'
import { mayUploadRecordings } from '@/lib/qari-upload-access'

export const runtime = 'nodejs'

/** GET /api/qari/upload-access?username=&userId= — whether this account gets the Upload button. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const username = params.get('username')?.trim().toLowerCase() ?? ''
  const userId = params.get('userId')?.trim() ?? ''
  const allowed = username && userId ? await mayUploadRecordings(request, username, userId) : false
  return NextResponse.json({ allowed }, { headers: { 'Cache-Control': 'no-store' } })
}
