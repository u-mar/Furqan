import { resolveQcfFontUrl, resolveSurahNameFontUrl } from '@/lib/offline-font-cache'
import { qcfPageFontFamily } from '@/lib/qcf-font-cdn'

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
const SENTINEL_TEXT = 'ﭑﭒﭓﭔ'

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
  return `@font-face{font-family:'${family}';src:url('${escapeCssUrl(srcUrl)}') format('woff2');font-weight:normal;font-style:normal;font-display:swap;}`
}

/** Register QCF page font via @font-face (QCF_P{n} → /qcf/p{n}.woff2 or CDN). */
export function ensureQcfFontFace(page: number, srcUrl: string): void {
  if (typeof document === 'undefined' || injectedFaces.has(page)) return
  const style = document.createElement('style')
  style.id = `qcf-font-face-p${page}`
  style.textContent = qcfFontFaceCss(page, srcUrl)
  document.head.appendChild(style)
  injectedFaces.add(page)
}

function measureTextWidth(text: string, fontFamily: string): number {
  if (typeof document === 'undefined') return 0
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0
  ctx.font = `${FONT_CHECK_SIZE_PX}px ${fontFamily}`
  return ctx.measureText(text).width
}

function verifyFontShape(family: string): boolean {
  const loaded = document.fonts.check(`${FONT_CHECK_SIZE_PX}px "${family}"`)
  if (!loaded) return false
  const widthTarget = measureTextWidth(SENTINEL_TEXT, `"${family}"`)
  const widthFallback = measureTextWidth(SENTINEL_TEXT, 'serif')
  return Math.abs(widthTarget - widthFallback) > 0.5
}

const preloadedLinks = new Set<number>()

export function preloadPageFontLink(page: number): void {
  if (typeof document === 'undefined') return
  if (page < 1 || page > 604 || preloadedLinks.has(page)) return
  preloadedLinks.add(page)

  void resolveQcfFontUrl(page).then((url) => {
    if (url.startsWith('blob:')) return
    const id = `qcf-preload-${page}`
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.crossOrigin = 'anonymous'
    link.href = url
    document.head.appendChild(link)
  })
}

export function prefetchPageFonts(center: number, radius = 2): void {
  if (typeof window === 'undefined') return
  void loadSurahNameFont()
  for (let p = center - radius; p <= center + radius; p += 1) {
    if (p >= 1 && p <= 604) {
      preloadPageFontLink(p)
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
      const response = await fetch(url, { cache: 'force-cache' })
      if (!response.ok) return false
      const buffer = await response.arrayBuffer()
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

export async function loadPageFont(page: number): Promise<boolean> {
  if (page < 1) return false
  if (loadedPages.has(page)) return true
  const pending = loadingPages.get(page)
  if (pending) return pending

  const task = (async () => {
    try {
      if (typeof document === 'undefined') return false
      const family = qcfPageFontFamily(page)
      await document.fonts.ready

      if (document.fonts.check(`16px "${family}"`) && verifyFontShape(family)) {
        loadedPages.add(page)
        return true
      }

      const url = await resolveQcfFontUrl(page)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] @font-face QCF', { page, family, url })
      }

      ensureQcfFontFace(page, url)
      await document.fonts.load(`${FONT_CHECK_SIZE_PX}px "${family}"`)
      await document.fonts.ready

      const ok = verifyFontShape(family)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] QCF font ready', { page, family, ok })
      }
      if (ok) loadedPages.add(page)
      return ok
    } catch (error) {
      if (shouldLogFontDebug()) {
        console.warn('[Muyassar] QCF font failed', { page, error })
      }
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
