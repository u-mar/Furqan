import type { MetadataRoute } from 'next'
import { APP_ICON_THEME_COLOR, APP_NAME } from '@/lib/app-brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Read the Quran and practice your hifdh with Al Furqaan',
    start_url: '/',
    scope: '/',
    // Standalone, not fullscreen: the phone's status and navigation bars are
    // present everywhere, and the reader hides them itself through the
    // Fullscreen API so they come back with its own controls. A fullscreen
    // manifest would hide them app-wide with no way to ask for them back.
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: APP_ICON_THEME_COLOR,
    theme_color: APP_ICON_THEME_COLOR,
    categories: ['books', 'education'],
    icons: [
      {
        src: '/icons/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
