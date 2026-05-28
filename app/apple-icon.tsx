import { ImageResponse } from 'next/og'
import {
  APP_ICON_LETTER,
  appIconLetterStyle,
  appIconShellStyle,
} from '@/lib/app-brand'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={appIconShellStyle(40)}>
        <div style={appIconLetterStyle(92)}>{APP_ICON_LETTER}</div>
      </div>
    ),
    { ...size }
  )
}
