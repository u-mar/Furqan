import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const AMIRI_WOFF =
  'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUr0td-Y.woff'

const BISMILLAH = 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'

export default async function AppleIcon() {
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
          background: 'linear-gradient(160deg, #064e3b 0%, #0a0a0a 60%)',
          padding: 16,
        }}
      >
        <div
          style={{
            color: '#5eead4',
            fontSize: 22,
            fontFamily: 'Amiri',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          {BISMILLAH}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Amiri', data: font, style: 'normal', weight: 400 }],
    }
  )
}
