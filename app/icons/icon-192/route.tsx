import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
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
        }}
      >
        <div style={{ color: '#fbbf24', fontSize: 96, fontWeight: 700, fontFamily: 'serif' }}>ق</div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
