import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const AMIRI_WOFF =
  'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUr0td-Y.woff'

export default async function Icon() {
  const font = await fetch(AMIRI_WOFF).then((res) => res.arrayBuffer())

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            color: '#2dd4bf',
            fontSize: 11,
            fontFamily: 'Amiri',
            lineHeight: 1.1,
            textAlign: 'center',
          }}
        >
          بسم
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Amiri', data: font, style: 'normal', weight: 400 }],
    }
  )
}
