'use client'

import { useEffect, useState } from 'react'
import { getSignedInUser, type AppUser } from '@/lib/auth'

/**
 * The signed-in user, kept in step with sign-in, sign-out and renames.
 *
 * Lives on its own rather than in QariShell so the tab bar — which the shell
 * renders — can use it without the two importing each other.
 */
export function useViewer(): AppUser | null {
  const [viewer, setViewer] = useState<AppUser | null>(null)

  useEffect(() => {
    const sync = () => setViewer(getSignedInUser())
    sync()
    window.addEventListener('auth-user-changed', sync)
    return () => window.removeEventListener('auth-user-changed', sync)
  }, [])

  return viewer
}
