import type { NextConfig } from 'next'

const allowedDevOrigins = [
  '192.168.100.188',
  '192.168.56.1',
  ...(process.env.ALLOWED_DEV_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, stale-while-revalidate=86400',
          },
        ],
      },
    ]
  },
}

export default nextConfig