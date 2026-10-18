import { appIconResponse } from '@/lib/app-icon'

export const runtime = 'edge'

/**
 * The small icon in the status bar when a notification arrives. Android uses
 * only its shape and tints it, so it is the word alone, in white, on nothing.
 */
export async function GET() {
  return appIconResponse(96, { scale: 1.3, badge: true })
}
