'use client'

import { useEffect, useRef } from 'react'

/**
 * The phone's back button in the Play Store app (components/NativeBack.tsx):
 * an open sheet or panel closes before anything else. Open ones, newest last.
 */
const openOnes: { close: () => void }[] = []

/** While `open`, the phone's back button closes this instead of leaving the screen. */
export function useCloseOnBack(open: boolean, onClose: () => void): void {
  // Held in a ref so an inline onClose does not re-register on every render.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const entry = { close: () => closeRef.current() }
    openOnes.push(entry)
    return () => {
      const index = openOnes.indexOf(entry)
      if (index >= 0) openOnes.splice(index, 1)
    }
  }, [open])
}

/** Closes the newest open sheet. False when none is open. */
export function closeNewestOnBack(): boolean {
  const entry = openOnes[openOnes.length - 1]
  if (!entry) return false
  entry.close()
  return true
}
