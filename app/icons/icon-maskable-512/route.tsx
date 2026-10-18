import { appIconResponse } from '@/lib/app-icon'

export const runtime = 'edge'

/**
 * The launcher icon Android shapes itself (circle, squircle…). The word is
 * drawn smaller, inside the middle circle every shape keeps.
 */
export async function GET() {
  return appIconResponse(512, { scale: 0.8 })
}
