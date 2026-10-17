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
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
      {
        // Pages are always checked for a newer version, so phones get the latest app. Not the API,
        // which says for itself how long each answer keeps (a verse forever, a feed not at all), nor
        // Next's own files, which it already marks: kept for good once built (their names change
        // with every build), never kept in development. A rule here overrides whatever the server
        // or a route sets itself.
        source: '/:path((?!api/|_next/static/|sw\\.js$|qcf/|fonts/|icons/|reciters/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, must-revalidate',
          },
        ],
      },
      {
        // The mushaf page fonts and the surah title font never change under the same name: kept
        // for a year instead of being checked again on every visit.
        source: '/:dir(qcf|fonts)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // The tab pictures and reciter portraits: kept a week.
        source: '/:dir(icons|reciters)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ]
  },
}

export default nextConfig
