import { areOfflineFontsCached, resolveQcfFontUrlsForLoad } from '@/lib/offline-font-cache'
import { hasBundledQuran } from '@/lib/native-app'
import {
  qcfCdnFontUrl,
  qcfPageFontFamily,
  SURAH_TITLE_FONT_FAMILY,
  SURAH_TITLE_FONT_URL,
  TOTAL_MUSHAF_FONT_PAGES,
} from '@/lib/qcf-font-cdn'

export {
  qcfCdnFontUrl,
  qcfLegacyLocalFontUrl,
  qcfLocalFontUrl,
  qcfPageFontFamily,
  SURAH_TITLE_FONT_FAMILY,
  TOTAL_MUSHAF_FONT_PAGES,
} from '@/lib/qcf-font-cdn'

const loadedPages = new Set<number>()
const injectedFaces = new Set<number>()
const loadingPages = new Map<number, Promise<boolean>>()
let surahNameLoaded = false
let surahNameLoading: Promise<boolean> | null = null
const FONT_CHECK_SIZE_PX = 40

/** @deprecated Use qcfPageFontFamily */
export function qcfFontFamily(page: number): string {
  return qcfPageFontFamily(page)
}

function shouldLogFontDebug(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debugFonts')
  )
}

function escapeCssUrl(url: string): string {
  return url.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function qcfFontFaceCss(page: number, srcUrl: string): string {
  const family = qcfPageFontFamily(page)
  return `@font-face{font-family:'${family}';src:url('${escapeCssUrl(srcUrl)}') format('woff2');font-weight:normal;font-style:normal;font-display:block;}`
}

/**
 * The page fonts are the King Fahd Complex's V4 fonts made for Naba (scripts/make-qcf-v4.py): the
 * letters are drawn in the text's own colour, so the reader's ink, highlights and themes apply as to
 * any text, and only the ayah ornament keeps colours of its own (its font palette entries 10 ring,
 * 11 flourishes, 12 fill), as in the 1440 print. The font's fill is clear, for pictures and videos,
 * which draw white words over a photo; Read's light page fills it light grey (--naba-light). On dark
 * and black the ornament is plain, in the ink. One palette each, for every page's family at once.
 */
const PALETTES: { name: string; colours: string }[] = [
  { name: '--naba-light', colours: '12 #e4e7ea' },
  { name: '--naba-dark', colours: '10 #e6e7e8, 11 #e6e7e8, 12 transparent' },
  { name: '--naba-black', colours: '10 #ece6da, 11 #ece6da, 12 transparent' },
]
let palettesAdded = false

function ensureQcfPalettes(): void {
  if (typeof document === 'undefined' || palettesAdded) return
  palettesAdded = true
  const families = Array.from({ length: TOTAL_MUSHAF_FONT_PAGES }, (_, i) => `'${qcfPageFontFamily(i + 1)}'`).join(',')
  const style = document.createElement('style')
  style.id = 'qcf-palettes'
  style.textContent = PALETTES.map(
    ({ name, colours }) => `@font-palette-values ${name}{font-family:${families};override-colors:${colours};}`
  ).join('')
  document.head.appendChild(style)
}

export function ensureQcfFontFace(page: number, srcUrl: string): void {
  if (typeof document === 'undefined' || injectedFaces.has(page)) return
  ensureQcfPalettes()
  const style = document.createElement('style')
  style.id = `qcf-font-face-p${page}`
  style.textContent = qcfFontFaceCss(page, srcUrl)
  document.head.appendChild(style)
  injectedFaces.add(page)
}

function normalizeFontFamily(name: string): string {
  return name.replace(/['"]/g, '').trim()
}

function isFamilyRegisteredAndLoaded(family: string): boolean {
  const target = normalizeFontFamily(family)
  for (const face of document.fonts) {
    if (normalizeFontFamily(face.family) === target && face.status === 'loaded') {
      return true
    }
  }
  return false
}

/**
 * QCF fonts only contain mushaf PUA glyphs. Compare render width vs generic serif.
 */
export function canRenderQcfGlyphs(family: string, sampleGlyphs: string): boolean {
  if (!sampleGlyphs.trim() || typeof document === 'undefined') {
    return isFamilyRegisteredAndLoaded(family)
  }

  if (!isFamilyRegisteredAndLoaded(family)) return false

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return true

  const size = 32
  ctx.direction = 'rtl'
  ctx.font = `${size}px serif`
  const fallbackWidth = ctx.measureText(sampleGlyphs).width

  ctx.font = `${size}px "${family}", serif`
  const qcfWidth = ctx.measureText(sampleGlyphs).width

  if (qcfWidth <= 0) return false
  if (fallbackWidth <= 0) return true
  return Math.abs(qcfWidth - fallbackWidth) > 0.5
}

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
  const isBlob = url.startsWith('blob:')
  const isSameOrigin =
    typeof window !== 'undefined' &&
    (url.startsWith('/') || url.startsWith(window.location.origin))
  const response = await fetch(url, {
    cache: 'force-cache',
    mode: isBlob || isSameOrigin ? 'same-origin' : 'cors',
  })
  if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`)
  return response.arrayBuffer()
}

function isSameOriginFontUrl(url: string): boolean {
  if (url.startsWith('/')) return true
  if (typeof window === 'undefined') return false
  return url.startsWith(window.location.origin)
}

async function loadViaFontFace(page: number, url: string, listRow: boolean): Promise<boolean> {
  const family = qcfPageFontFamily(page)
  const buffer = await fetchFontBuffer(url)
  const face = new FontFace(family, buffer, { display: 'block' })
  const loaded = await face.load()
  document.fonts.add(loaded)
  ensureQcfPalettes()
  if (listRow) return loaded.status === 'loaded'
  const cssUrl = isSameOriginFontUrl(url) ? url : qcfCdnFontUrl(page)
  ensureQcfFontFace(page, cssUrl)
  await document.fonts.ready
  return loaded.status === 'loaded' && isFamilyRegisteredAndLoaded(family)
}

export function preloadPageFontLink(page: number): void {
  if (typeof document === 'undefined') return
  if (page < 1 || page > 604) return
  void loadPageFont(page)
}

export function prefetchPageFonts(center: number, radius = 1): void {
  if (typeof window === 'undefined') return
  void loadSurahNameFont()
  for (let p = center - radius; p <= center + radius; p += 1) {
    if (p >= 1 && p <= 604 && p !== center) {
      void loadPageFont(p)
    }
  }
}

export async function loadSurahNameFont(): Promise<boolean> {
  if (surahNameLoaded) return true
  if (surahNameLoading) return surahNameLoading

  surahNameLoading = (async () => {
    try {
      if (typeof document === 'undefined') return false
      if (document.fonts.check('16px "SurahNameV2"')) {
        surahNameLoaded = true
        return true
      }
      // The @font-face rule in globals.css does the loading, so the file is
      // fetched once (and from the phone's cache once saved). Fetching it here
      // as well downloaded the same font twice side by side.
      try {
        await document.fonts.load(`${FONT_CHECK_SIZE_PX}px "SurahNameV2"`)
      } catch {
        /* checked below */
      }
      surahNameLoaded = document.fonts.check('16px "SurahNameV2"')
      return surahNameLoaded
    } catch {
      return false
    } finally {
      surahNameLoading = null
    }
  })()

  return surahNameLoading
}

/**
 * @param listRow One of many rows on different pages. Skips the second @font-face
 * rule, which downloads the file again and re-lays the page out, and the waits for
 * every other font in flight, which hold a row back while a long list scrolls.
 */
export async function loadPageFont(
  page: number,
  sampleGlyphs?: string,
  listRow = false
): Promise<boolean> {
  if (page < 1) return false

  const family = qcfPageFontFamily(page)
  const sample = sampleGlyphs?.trim() ?? ''

  // Only a font that was accepted is in loadedPages, so it is not checked again.
  if (loadedPages.has(page) && isFamilyRegisteredAndLoaded(family)) {
    return true
  }

  const pending = loadingPages.get(page)
  if (pending) return pending

  const task = (async () => {
    try {
      if (typeof document === 'undefined') return false
      if (!listRow) await document.fonts.ready

      const urls = await resolveQcfFontUrlsForLoad(page)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] Loading QCF font', { page, family, urls })
      }

      // The glyph check compares the page font's width with a plain font's, and on some phones the
      // two can happen to match: page 130 then counted as not loaded and showed only the error,
      // retrying in vain. The app's own fonts are the originals, so it is skipped there.
      const skipGlyphCheck =
        (typeof navigator !== 'undefined' && !navigator.onLine) || areOfflineFontsCached() || hasBundledQuran()

      // A font that loaded but failed the check: still used if nothing better turns up, since the
      // check can be wrong and the page font is far better than an error.
      let loadedButUnchecked: string | null = null

      for (const url of urls) {
        try {
          const ok = await loadViaFontFace(page, url, listRow)
          if (!ok) continue
          if (sample && !skipGlyphCheck && !canRenderQcfGlyphs(family, sample)) {
            loadedButUnchecked ??= url
            if (shouldLogFontDebug()) {
              console.warn('[Muyassar] QCF font loaded but glyphs did not render', {
                page,
                family,
                url,
              })
            }
            continue
          }
          loadedPages.add(page)
          if (shouldLogFontDebug()) {
            console.info('[Muyassar] QCF font ready', { page, family, url })
          }
          return true
        } catch (err) {
          if (shouldLogFontDebug()) {
            console.warn('[Muyassar] QCF font attempt failed', { page, url, err })
          }
        }
      }

      if (loadedButUnchecked && isFamilyRegisteredAndLoaded(family)) {
        loadedPages.add(page)
        if (shouldLogFontDebug()) {
          console.info('[Muyassar] QCF font used although the glyph check failed', { page, url: loadedButUnchecked })
        }
        return true
      }

      loadedPages.delete(page)
      return false
    } catch (error) {
      if (shouldLogFontDebug()) {
        console.warn('[Muyassar] QCF font failed', { page, error })
      }
      loadedPages.delete(page)
      return false
    } finally {
      loadingPages.delete(page)
    }
  })()

  loadingPages.set(page, task)
  return task
}

let surahTitleLoading: Promise<boolean> | null = null

export function loadSurahTitleFont(): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  if (!surahTitleLoading) {
    surahTitleLoading = (async () => {
      try {
        const face = new FontFace(SURAH_TITLE_FONT_FAMILY, await fetchFontBuffer(SURAH_TITLE_FONT_URL), {
          display: 'block',
        })
        document.fonts.add(await face.load())
        return true
      } catch {
        surahTitleLoading = null
        return false
      }
    })()
  }
  return surahTitleLoading
}

export function isPageFontLoaded(page: number): boolean {
  return loadedPages.has(page)
}

export function clearPageFontLoaded(page: number): void {
  loadedPages.delete(page)
}
