import { resolveQcfFontUrl, resolveSurahNameFontUrl } from '@/lib/offline-font-cache'

export { qcfCdnFontUrl, qcfLocalFontUrl } from '@/lib/qcf-font-cdn'

const loadedPages = new Set<number>()
const loadingPages = new Map<number, Promise<boolean>>()
let surahNameLoaded = false
let surahNameLoading: Promise<boolean> | null = null

export function qcfFontFamily(page: number): string {
  return `QCFPage${page}V2`
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
      const face = new FontFace('SurahNameV2', `url(${url})`, { display: 'swap' })
      const loaded = await face.load()
      document.fonts.add(loaded)
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
      const face = new FontFace(family, `url(${url})`, { display: 'block' })
      const loaded = await face.load()
      document.fonts.add(loaded)
      loadedPages.add(page)
      return document.fonts.check(`16px "${family}"`)
    } catch {
      return false
    } finally {
      loadingPages.delete(page)
    }
  })()

  loadingPages.set(page, task)
  return task
}
