'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  favoritesInGroup,
  getFavoriteReciterIds,
  toggleFavoriteReciter,
  MAX_FAVORITE_RECITERS,
  RECITER_FAVORITES_EVENT,
} from '@/lib/reciter-favorites'

export function useReciterFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  /** False until the saved favourites are read, so a screen need not flash the empty state. */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setFavoriteIds(getFavoriteReciterIds())
    setReady(true)
    const onChange = (e: Event) => {
      setFavoriteIds((e as CustomEvent<string[]>).detail ?? getFavoriteReciterIds())
    }
    window.addEventListener(RECITER_FAVORITES_EVENT, onChange)
    return () => window.removeEventListener(RECITER_FAVORITES_EVENT, onChange)
  }, [])

  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds])

  /** Returns the new favorited state — stays `false` if the 5-favorite cap blocked an add. */
  const toggle = useCallback((id: string) => toggleFavoriteReciter(id), [])

  /** The well-known reciters' five are all taken. */
  const atLimit = favoritesInGroup(favoriteIds, '') >= MAX_FAVORITE_RECITERS
  /** The five that `id` would join are all taken. */
  const isFullFor = useCallback((id: string) => favoritesInGroup(favoriteIds, id) >= MAX_FAVORITE_RECITERS, [favoriteIds])

  return { favoriteIds, isFavorite, toggle, atLimit, isFullFor, ready, maxFavorites: MAX_FAVORITE_RECITERS }
}
