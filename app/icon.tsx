import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #065f46 0%, #0a0a0a 70%)',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            color: '#5eead4',
            fontSize: 18,
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
