import { appIconResponse } from '@/lib/app-icon'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/** The browser tab icon: the word a little larger on its square, so it reads at 16px too. */
export default function Icon() {
  return appIconResponse(size.width, { scale: 1.15, radius: 7 })
}
