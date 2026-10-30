import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/app-brand'
import { findVideoBackground } from '@/lib/qari-backgrounds'

/**
 * What a link shows when it is pasted into WhatsApp, Telegram or Facebook:
 * a title, a line, and a picture. Pages that have nothing better show the
 * Naba banner (public/og.png).
 */

export const SITE_URL = 'https://qurannaba.com'

const DEFAULT_IMAGE = { url: '/og.png', width: 1200, height: 630, alt: APP_NAME }

export function openGraphFor({
  title,
  description,
  image,
}: {
  title: string
  description: string
  /** An absolute URL, or one starting with "/" on this site. */
  image?: string | null
}): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = image ? [{ url: image }] : [DEFAULT_IMAGE]
  return {
    openGraph: { title, description, siteName: APP_NAME, type: 'website', images },
    twitter: { card: 'summary_large_image', title, description, images: images.map((i) => i.url) },
  }
}

/**
 * The picture for a shared recitation: an ayah card's own picture, else a still
 * of the background it was posted on, cropped to the shape link previews use.
 * Null for the plain black background, which says nothing a banner does not.
 */
export function recitationPreviewImage(r: { id: string; kind: string | null; imageId: string | null; background: string | null }): string | null {
  if (r.kind === 'ayah') return r.imageId ? `/api/qari/image/${r.id}` : null
  if (!r.background) return null
  const background = findVideoBackground(r.background)
  if (!background.url) return null
  // Cloudinary crops on request: a moving clip's still, or a photo, at 1200 x 630.
  if (background.url.includes('/video/upload/')) {
    return background.url.replace('/video/upload/', '/video/upload/w_1200,h_630,c_fill,g_auto,q_auto,f_jpg/')
  }
  return background.url
}
