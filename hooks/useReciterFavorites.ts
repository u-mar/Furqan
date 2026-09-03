'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getFavoriteReciterIds,
  toggleFavoriteReciter,
  MAX_FAVORITE_RECITERS,
  RECITER_FAVORITES_EVENT,
} from '@/lib/reciter-favorites'

export function useReciterFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])

  useEffect(() => {
    setFavoriteIds(getFavoriteReciterIds())
    const onChange = (e: Event) => {
      setFavoriteIds((e as CustomEvent<string[]>).detail ?? getFavoriteReciterIds())
    }
    window.addEventListener(RECITER_FAVORITES_EVENT, onChange)
    return () => window.removeEventListener(RECITER_FAVORITES_EVENT, onChange)
  }, [])

  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds])

  /** Returns the new favorited state — stays `false` if the 5-favorite cap blocked an add. */
  const toggle = useCallback((id: string) => toggleFavoriteReciter(id), [])

  const atLimit = favoriteIds.length >= MAX_FAVORITE_RECITERS

  return { favoriteIds, isFavorite, toggle, atLimit, maxFavorites: MAX_FAVORITE_RECITERS }
}
