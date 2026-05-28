import { ImageResponse } from 'next/og'
import {
  APP_ICON_LETTER,
  appIconLetterStyle,
  appIconShellStyle,
} from '@/lib/app-brand'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={appIconShellStyle(7)}>
        <div style={appIconLetterStyle(19)}>{APP_ICON_LETTER}</div>
      </div>
    ),
    { ...size }
  )
}
