'use client'

import { useEffect, useState } from 'react'
import AdminDashboard from '@/components/admin/AdminDashboard'
import AdminLogin from '@/components/admin/AdminLogin'
import HomeScreen from '@/components/home/HomeScreen'
import { checkAdminSession } from '@/lib/admin-api'

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/auth/session', { credentials: 'include', cache: 'no-store' })
        const data = (await res.json()) as { authenticated?: boolean; configured?: boolean }
        setConfigured(data.configured !== false)
        setAuthed(Boolean(data.authenticated))
      } catch {
        setAuthed(await checkAdminSession())
      }
    })()
  }, [])

  if (authed === null) {
    return (
      <HomeScreen className="flex min-h-[100dvh] items-center justify-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--home-sage-deep)]"
          role="status"
          aria-label="Loading"
        />
      </HomeScreen>
    )
  }

  if (!authed) {
    return (
      <HomeScreen>
        <AdminLogin configured={configured} onSuccess={() => setAuthed(true)} />
      </HomeScreen>
    )
  }

  return (
    <HomeScreen className="px-0 py-0">
      <AdminDashboard />
    </HomeScreen>
  )
}
