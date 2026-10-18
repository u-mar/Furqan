import { appIconResponse } from '@/lib/app-icon'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** Square to the edges: iOS rounds the corners itself. */
export default function AppleIcon() {
  return appIconResponse(size.width)
}
