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

/** QCF page fonts only map mushaf PUA glyphs — `fonts.check()` defaults to Latin "B" and falsely fails. */
function isFamilyRegisteredAndLoaded(family: string): boolean {
  const target = normalizeFontFamily(family)
  for (const face of document.fonts) {
    if (normalizeFontFamily(face.family) === target && face.status === 'loaded') {
      return true
    }
  }
  return false
}

function isFamilyLoaded(family: string): boolean {
  if (isFamilyRegisteredAndLoaded(family)) return true
  return document.fonts.check(`${FONT_CHECK_SIZE_PX}px "${family}"`)
}

async function waitForFamily(family: string, attempts = 8): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await document.fonts.load(`${FONT_CHECK_SIZE_PX}px "${family}"`)
    } catch {
      /* load() may reject even when @font-face is valid */
    }
    await document.fonts.ready
    if (isFamilyRegisteredAndLoaded(family)) return true
    if (document.fonts.check(`${FONT_CHECK_SIZE_PX}px "${family}"`)) return true
    await new Promise((r) => setTimeout(r, 120))
  }
  return isFamilyRegisteredAndLoaded(family)
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

/** FontFace API — primary loader; works for CDN and SW-backed /qcf/ URLs. */
async function loadViaFontFace(page: number, url: string): Promise<boolean> {
  const family = qcfPageFontFamily(page)
  const buffer = await fetchFontBuffer(url)
  const face = new FontFace(family, buffer, { display: 'block' })
  const loaded = await face.load()
  document.fonts.add(loaded)
  if (isSameOriginFontUrl(url)) {
    ensureQcfFontFace(page, url)
  }
  if (loaded.status === 'loaded') return true
  return waitForFamily(family)
}

export function preloadPageFontLink(page: number): void {
  if (typeof document === 'undefined') return
  if (page < 1 || page > 604) return
  void loadPageFont(page)
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

      if (isFamilyLoaded(family)) {
        loadedPages.add(page)
        return true
      }

      const url = await resolveQcfFontUrl(page)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] Loading QCF font', { page, family, url })
      }

      let ok = false
      try {
        ok = await loadViaFontFace(page, url)
      } catch (fontFaceErr) {
        if (shouldLogFontDebug()) {
          console.warn('[Muyassar] QCF FontFace load failed', { page, fontFaceErr })
        }
      }

      if (!ok) {
        ensureQcfFontFace(page, url)
        ok = await waitForFamily(family)
      }

      if (shouldLogFontDebug()) {
        console.info('[Muyassar] QCF font result', { page, family, ok })
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
