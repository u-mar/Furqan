'use client'

import { useSyncExternalStore } from 'react'

const never = () => () => {}

/**
 * False while the server's HTML is being hydrated, true afterwards (and
 * straight away on in-app navigation). For parts drawn from this phone's own
 * settings, which the server cannot know.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    never,
    () => true,
    () => false
  )
}
