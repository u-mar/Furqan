'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  getFavoriteReciterIds,
  toggleFavoriteReciter,
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

  const toggle = useCallback((id: string) => {
    toggleFavoriteReciter(id)
  }, [])

  return { favoriteIds, isFavorite, toggle }
}
