'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** How the Qari home shows recitations: a list of cards, or full-screen swipe. */
export type QariView = 'list' | 'swipe'

const KEY = 'muyassar_qari_view'
const listeners = new Set<() => void>()

function read(): QariView {
  try {
    return localStorage.getItem(KEY) === 'swipe' ? 'swipe' : 'list'
  } catch {
    return 'list'
  }
}

/**
 * The chosen view, remembered on the phone. The list is the default: with few
 * recitations a swipe feed ends after a handful of swipes.
 */
export function useQariView(): [QariView, (view: QariView) => void] {
  const view = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => 'list' as const
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
