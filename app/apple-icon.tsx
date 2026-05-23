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
          background: 'linear-gradient(160deg, #064e3b 0%, #0a0a0a 60%)',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            color: '#5eead4',
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
