import type { MetadataRoute } from 'next'
import { APP_ICON_THEME_COLOR, APP_NAME } from '@/lib/app-brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // A fixed identity, so the installed app (and the Play Store wrapper) stays the same app if start_url ever changes.
    id: '/',
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Read the Quran in the Madani mushaf, listen to great reciters, share your own recitation and read together in a halaqa.',
    lang: 'en',
    dir: 'ltr',
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
        purpose: 'any',
      },
      {
        // Android crops this one to its own shape, so the letter sits well inside it.
        src: '/icons/icon-maskable-512',
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
    // Long-press the app icon for these.
    shortcuts: [
      { name: 'Read', short_name: 'Read', url: '/read', icons: [{ src: '/icons/icon-192', sizes: '192x192', type: 'image/png' }] },
      { name: 'Listen', short_name: 'Listen', url: '/listen', icons: [{ src: '/icons/icon-192', sizes: '192x192', type: 'image/png' }] },
      { name: 'Qari', short_name: 'Qari', url: '/qari', icons: [{ src: '/icons/icon-192', sizes: '192x192', type: 'image/png' }] },
      { name: 'Prayer times', short_name: 'Prayer', url: '/prayer', icons: [{ src: '/icons/icon-192', sizes: '192x192', type: 'image/png' }] },
    ],
  }
}
