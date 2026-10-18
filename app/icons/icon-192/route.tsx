import { appIconResponse } from '@/lib/app-icon'

export const runtime = 'edge'

export async function GET() {
  return appIconResponse(192)
}
