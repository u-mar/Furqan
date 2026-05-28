import { ImageResponse } from 'next/og'
import {
  APP_ICON_LETTER,
  appIconLetterStyle,
  appIconShellStyle,
} from '@/lib/app-brand'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div style={appIconShellStyle(0)}>
        <div style={appIconLetterStyle(100)}>{APP_ICON_LETTER}</div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
