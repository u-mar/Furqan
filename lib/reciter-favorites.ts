const STORAGE_KEY = 'muyassar_favorite_reciters'
const EVENT_NAME = 'reciter-favorites-changed'

/** You can keep a small, curated bench of favorites — not the whole list. */
export const MAX_FAVORITE_RECITERS = 5

/** Shown until the user customizes their favorites — they're free to unfavorite any of these. */
const DEFAULT_FAVORITE_RECITER_IDS = [
  'ajmi',
  'soufi',
  'idris_abkar',
  'nourin_siddig',
  'hassan_al_wajdi',
]

/**
 * Defaults that were later replaced, as [old, new]. Someone who saved their
 * favorites while the old default was in the list gets the new one once, in
 * the same place, instead of keeping a reciter the app no longer suggests.
 */
const REPLACED_DEFAULTS: Array<[string, string]> = [['hazaa_balushi', 'hassan_al_wajdi']]
const REPLACED_KEY = 'muyassar_favorite_reciters_replaced_v1'

function applyReplacedDefaults(ids: string[]): string[] {
  if (localStorage.getItem(REPLACED_KEY)) return ids
  localStorage.setItem(REPLACED_KEY, '1')
  let next = ids
  for (const [from, to] of REPLACED_DEFAULTS) {
    if (!next.includes(from)) continue
    next = next.includes(to) ? next.filter((id) => id !== from) : next.map((id) => (id === from ? to : id))
  }
  if (next !== ids) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

function readIds(): string[] {
  if (typeof window === 'undefined') return DEFAULT_FAVORITE_RECITER_IDS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return DEFAULT_FAVORITE_RECITER_IDS
    const parsed = JSON.parse(raw) as unknown
    const ids = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    return applyReplacedDefaults(ids)
  } catch {
    return DEFAULT_FAVORITE_RECITER_IDS
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
