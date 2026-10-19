'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** How the Qari home shows recitations: a list of cards, or full-screen swipe. */
export type QariView = 'list' | 'swipe'

const KEY = 'muyassar_qari_view'
const listeners = new Set<() => void>()

function read(): QariView {
  try {
    return localStorage.getItem(KEY) === 'list' ? 'list' : 'swipe'
  } catch {
    return 'swipe'
  }
}

/** The chosen view, remembered on the phone. Video, full-screen swipe, until the list is picked. */
export function useQariView(): [QariView, (view: QariView) => void] {
  const view = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => 'swipe' as const
  )
  const setView = useCallback((next: QariView) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // The choice then lasts only until the app is reopened.
    }
    listeners.forEach((listener) => listener())
  }, [])
  return [view, setView]
}
