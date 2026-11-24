/**
 * The mushaf's page fonts, one WOFF2 per page (1–604): the King Fahd Complex's V4 (1441H) fonts with
 * the letters in the text's own colour and only the ayah ornaments coloured, made by
 * scripts/make-qcf-v4.py and kept on Naba's own storage. The same files are in public/qcf for the app.
 */
export const QCF_FONT_CDN_BASE = 'https://audio.qurannaba.com/qcf5'

/** Calligraphic "سورة …" titles, one ligature per surah (text `surah011`). */
export const SURAH_TITLE_FONT_URL = 'https://static-cdn.tarteel.ai/qul/fonts/surah-names/v2/surah-name-v2.ttf'
export const SURAH_TITLE_FONT_FAMILY = 'NadirSurahTitle'

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
