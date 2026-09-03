const STORAGE_KEY = 'muyassar_favorite_reciters'
const EVENT_NAME = 'reciter-favorites-changed'

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

export function addFavoriteReciter(id: string): string[] {
  const ids = readIds()
  if (ids.includes(id)) return ids
  const next = [id, ...ids]
  writeIds(next)
  return next
}

export function removeFavoriteReciter(id: string): string[] {
  const next = readIds().filter((existing) => existing !== id)
  writeIds(next)
  return next
}

/** Toggle a reciter's favorite state. Returns the new favorite/unfavorite status. */
export function toggleFavoriteReciter(id: string): boolean {
  if (isFavoriteReciter(id)) {
    removeFavoriteReciter(id)
    return false
  }
  addFavoriteReciter(id)
  return true
}

export const RECITER_FAVORITES_EVENT = EVENT_NAME
