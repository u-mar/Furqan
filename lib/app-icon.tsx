import { ImageResponse } from 'next/og'
import {
  LOGO_BLOCK_RADIUS,
  LOGO_GOLD,
  LOGO_GROUND,
  LOGO_INK,
  LOGO_LETTERS,
  LOGO_MARKS,
  logoViewBox,
} from '@/lib/app-logo'

/**
 * A PNG of the app icon: نبأ in square Kufic on its black square.
 * `scale` sizes the word on the square (1 = as designed), `radius` rounds the
 * square's corners, and `badge` draws the word alone in white on transparent:
 * the shape Android tints for the notification badge in the status bar.
 */
export function appIconResponse(
  size: number,
  { scale = 1, radius = 0, badge = false }: { scale?: number; radius?: number; badge?: boolean } = {}
): ImageResponse {
  const ink = badge ? '#ffffff' : LOGO_INK
  const gold = badge ? '#ffffff' : LOGO_GOLD
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: badge ? 'transparent' : LOGO_GROUND,
          borderRadius: radius,
        }}
      >
        <svg width={size} height={size} viewBox={logoViewBox(scale)}>
          {LOGO_LETTERS.map(([x, y, width, height], index) => (
            <rect key={`l${index}`} x={x} y={y} width={width} height={height} rx={LOGO_BLOCK_RADIUS} fill={ink} />
          ))}
          {LOGO_MARKS.map(([x, y, width, height], index) => (
            <rect key={`m${index}`} x={x} y={y} width={width} height={height} rx={LOGO_BLOCK_RADIUS} fill={gold} />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size }
  )
}
