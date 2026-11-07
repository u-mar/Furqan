'use client'

import { useEffect, useState } from 'react'
import { checkAdminSession } from '@/lib/admin-api'

/** Asked of the server once per visit (signing in or out at /admin reloads that page). */
let asked: Promise<boolean> | null = null

/**
 * Whether this phone is signed in at /admin. The server checks the same
 * session itself on every change, so this only decides what to offer.
 */
export function useIsAdmin(): boolean {
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    let cancelled = false
    asked ??= checkAdminSession()
    void asked.then((yes) => {
      if (!cancelled) setAdmin(yes)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return admin
}

/** After signing in or out at /admin, ask again. */
export function forgetAdminCheck(): void {
  asked = null
}
