import type { MushafStyle } from '@/lib/app-settings'
import { areOfflineFontsCached } from '@/lib/offline-font-cache'

/** User chose printed mushaf (needs per-page QCF fonts). */
export function wantsUthmaniGlyphs(style: MushafStyle): boolean {
  return style === 'uthmani-glyphs'
}

/** True when we should attempt loading QCF page fonts (online or fonts already cached). */
export function shouldAttemptQcfFonts(style: MushafStyle): boolean {
  if (!wantsUthmaniGlyphs(style)) return false
  if (typeof navigator !== 'undefined' && navigator.onLine) return true
  return areOfflineFontsCached()
}

/** Plain Arabic stack — always renders connected letters without QCF fonts. */
export const PLAIN_MUSHAF_FONT =
  "'UthmanicHafs', var(--font-amiri), 'Amiri', 'Traditional Arabic', serif"
