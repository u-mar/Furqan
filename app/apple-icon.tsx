import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #065f46 0%, #000 55%)',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            color: '#fbbf24',
            fontSize: 88,
            fontWeight: 700,
            fontFamily: 'serif',
          }}
        >
          ق
        </div>
      </div>
    ),
    { ...size }
  )
}
