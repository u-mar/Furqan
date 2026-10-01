import { ImageResponse } from 'next/og'
import { APP_ICON_LETTER, appIconLetterStyle, appIconShellStyle } from '@/lib/app-brand'

export const runtime = 'edge'

/**
 * The launcher icon Android shapes itself (circle, squircle…). The letter is
 * kept inside the middle 60%, the part every shape keeps.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div style={appIconShellStyle(0)}>
        <div style={appIconLetterStyle(196)}>{APP_ICON_LETTER}</div>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
