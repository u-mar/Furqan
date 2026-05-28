/** Madani mushaf QCF v2 — one WOFF2 file per page (1–604). */
export const QCF_FONT_CDN_BASE = 'https://verses.quran.foundation/fonts/quran/hafs/v2/woff2'

export const SURAH_NAME_FONT_URL =
  'https://static-cdn.tarteel.ai/qul/fonts/surah-names/v2/surah-name-v2.ttf'

export const TOTAL_MUSHAF_FONT_PAGES = 604

/** CSS font-family for a mushaf page (e.g. QCF_P542). */
export function qcfPageFontFamily(page: number): string {
  return `QCF_P${page}`
}

export function qcfCdnFontUrl(page: number): string {
  return `${QCF_FONT_CDN_BASE}/p${page}.woff2`
}

/** Primary bundled path: public/qcf/p{n}.woff2 */
export function qcfLocalFontUrl(page: number): string {
  return `/qcf/p${page}.woff2`
}

/** Legacy path from older downloads. */
export function qcfLegacyLocalFontUrl(page: number): string {
  return `/fonts/qcf/p${page}.woff2`
}
