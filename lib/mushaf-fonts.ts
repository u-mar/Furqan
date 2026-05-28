import { resolveQcfFontUrlsForLoad, resolveSurahNameFontUrl } from '@/lib/offline-font-cache'
import { qcfCdnFontUrl, qcfPageFontFamily } from '@/lib/qcf-font-cdn'

export {
  qcfCdnFontUrl,
  qcfLegacyLocalFontUrl,
  qcfLocalFontUrl,
  qcfPageFontFamily,
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

export function ensureQcfFontFace(page: number, srcUrl: string): void {
  if (typeof document === 'undefined' || injectedFaces.has(page)) return
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

async function loadViaFontFace(page: number, url: string): Promise<boolean> {
  const family = qcfPageFontFamily(page)
  const buffer = await fetchFontBuffer(url)
  const face = new FontFace(family, buffer, { display: 'block' })
  const loaded = await face.load()
  document.fonts.add(loaded)
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
      const url = await resolveSurahNameFontUrl()
      const buffer = await fetchFontBuffer(url)
      const face = new FontFace('SurahNameV2', buffer, { display: 'block' })
      const loaded = await face.load()
      document.fonts.add(loaded)
      await document.fonts.load(`${FONT_CHECK_SIZE_PX}px "SurahNameV2"`)
      surahNameLoaded = true
      return true
    } catch {
      return false
    } finally {
      surahNameLoading = null
    }
  })()

  return surahNameLoading
}

export async function loadPageFont(
  page: number,
  sampleGlyphs?: string
): Promise<boolean> {
  if (page < 1) return false

  const family = qcfPageFontFamily(page)
  const sample = sampleGlyphs?.trim() ?? ''

  if (
    loadedPages.has(page) &&
    isFamilyRegisteredAndLoaded(family) &&
    (!sample || canRenderQcfGlyphs(family, sample))
  ) {
    return true
  }

  const pending = loadingPages.get(page)
  if (pending) return pending

  const task = (async () => {
    try {
      if (typeof document === 'undefined') return false
      await document.fonts.ready

      const urls = await resolveQcfFontUrlsForLoad(page)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] Loading QCF font', { page, family, urls })
      }

      for (const url of urls) {
        try {
          const ok = await loadViaFontFace(page, url)
          if (!ok) continue
          if (sample && !canRenderQcfGlyphs(family, sample)) {
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

export function isPageFontLoaded(page: number): boolean {
  return loadedPages.has(page)
}

export function clearPageFontLoaded(page: number): void {
  loadedPages.delete(page)
}
