import { resolveQcfFontUrl, resolveSurahNameFontUrl } from '@/lib/offline-font-cache'

export { qcfCdnFontUrl, qcfLocalFontUrl } from '@/lib/qcf-font-cdn'

const loadedPages = new Set<number>()
const loadingPages = new Map<number, Promise<boolean>>()
let surahNameLoaded = false
let surahNameLoading: Promise<boolean> | null = null
const FONT_CHECK_SIZE_PX = 40
const SENTINEL_TEXT = 'ﭑﭒﭓﭔ'

function shouldLogFontDebug(): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debugFonts')
  )
}

export function qcfFontFamily(page: number): string {
  return `p${page}-v2`
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

async function fetchFontBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`)
  return response.arrayBuffer()
}

export function prefetchPageFonts(center: number, radius = 2): void {
  if (typeof window === 'undefined') return
  void loadSurahNameFont()
  for (let p = center - radius; p <= center + radius; p += 1) {
    if (p >= 1 && p <= 604) void loadPageFont(p)
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
      const family = qcfFontFamily(page)
      await document.fonts.ready
      if (document.fonts.check(`16px "${family}"`)) {
        loadedPages.add(page)
        return true
      }
      const url = await resolveQcfFontUrl(page)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] Loading QCF font', { page, family, url })
      }
      const buffer = await fetchFontBuffer(url)
      const face = new FontFace(family, buffer, { display: 'block' })
      const loaded = await face.load()
      document.fonts.add(loaded)
      await document.fonts.load(`${FONT_CHECK_SIZE_PX}px "${family}"`)
      await document.fonts.ready
      const ok = verifyFontShape(family)
      if (shouldLogFontDebug()) {
        console.info('[Muyassar] QCF font loaded', {
          page,
          family,
          ok,
          activeFonts: Array.from(document.fonts).map((font) => font.family),
        })
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
