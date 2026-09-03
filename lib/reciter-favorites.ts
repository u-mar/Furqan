const STORAGE_KEY = 'muyassar_favorite_reciters'
const EVENT_NAME = 'reciter-favorites-changed'

/** You can keep a small, curated bench of favorites — not the whole list. */
export const MAX_FAVORITE_RECITERS = 5

function readIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  window.dispatchEvent(new CustomEvent<string[]>(EVENT_NAME, { detail: ids }))
}

export function getFavoriteReciterIds(): string[] {
  return readIds()
}

export function isFavoriteReciter(id: string): boolean {
  return readIds().includes(id)
}

/** Returns false (and leaves favorites unchanged) once MAX_FAVORITE_RECITERS is reached. */
export function addFavoriteReciter(id: string): boolean {
  const ids = readIds()
  if (ids.includes(id)) return true
  if (ids.length >= MAX_FAVORITE_RECITERS) return false
  writeIds([id, ...ids])
  return true
}

export function removeFavoriteReciter(id: string): string[] {
  const next = readIds().filter((existing) => existing !== id)
  writeIds(next)
  return next
}

/**
 * Toggle a reciter's favorite state.
 * Returns the new favorite/unfavorite status — stays `false` (no-op) if you're
 * trying to add a 6th favorite past the MAX_FAVORITE_RECITERS cap.
 */
export function toggleFavoriteReciter(id: string): boolean {
  if (isFavoriteReciter(id)) {
    removeFavoriteReciter(id)
    return false
  }
  return addFavoriteReciter(id)
}

export const RECITER_FAVORITES_EVENT = EVENT_NAME
