export interface AyahBookmark {
  verseKey: string
  surahName: string
  ayah: number
  page: number
  arabic: string
  createdAt: number
  /**
   * The ayah's QCF mushaf glyphs and the font-family they need, so the
   * Bookmarks list can show the exact printed mushaf script instead of a
   * plain Arabic font. Absent on bookmarks saved before this existed, or
   * when the reader had no QCF data for that verse — falls back to `arabic`.
   */
  qcfGlyphs?: string
  qcfFontFamily?: string
}

const STORAGE_KEY = 'muyassar_ayah_bookmarks'

function readBookmarks(): AyahBookmark[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AyahBookmark[]) : []
  } catch {
    return []
  }
}

function writeBookmarks(bookmarks: AyahBookmark[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
}

export function getBookmarks(): AyahBookmark[] {
  return readBookmarks()
}

export function isBookmarked(verseKey: string): boolean {
  return readBookmarks().some((bookmark) => bookmark.verseKey === verseKey)
}

export function addBookmark(bookmark: AyahBookmark): void {
  const bookmarks = readBookmarks().filter((item) => item.verseKey !== bookmark.verseKey)
  writeBookmarks([{ ...bookmark, createdAt: bookmark.createdAt || Date.now() }, ...bookmarks])
}

export function removeBookmark(verseKey: string): void {
  writeBookmarks(readBookmarks().filter((bookmark) => bookmark.verseKey !== verseKey))
}

export function toggleBookmark(bookmark: AyahBookmark): boolean {
  if (isBookmarked(bookmark.verseKey)) {
    removeBookmark(bookmark.verseKey)
    return false
  }

  addBookmark(bookmark)
  return true
}
