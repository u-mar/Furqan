'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { ChevronLeft, LayoutDashboard, Megaphone, MessageSquare, Shield, Users } from 'lucide-react'
import { cn } from '@/lib/cn'

export type AdminSection = 'overview' | 'daily-verse' | 'feedback' | 'users' | 'popups'

const NAV: { id: AdminSection; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'daily-verse', label: 'Daily Verse', Icon: Megaphone },
  { id: 'feedback', label: 'Feedback', Icon: MessageSquare },
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'popups', label: 'Popups', Icon: Megaphone },
]

interface AdminShellProps {
  section: AdminSection
  onSectionChange: (section: AdminSection) => void
  saveNotice: string
  children: ReactNode
}

export default function AdminShell({
  section,
  onSectionChange,
  saveNotice,
  children,
}: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col lg:flex-row">
      <aside
        className={cn(
          'shrink-0 border-[var(--home-card-border)] bg-[var(--home-card-bg)] lg:w-56 lg:border-r',
          mobileNavOpen ? 'border-b' : 'hidden lg:block'
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--home-card-border)] px-4 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-[var(--home-sage-deep)]" />
            <span className="text-sm font-semibold text-[var(--home-heading)]">Admin</span>
          </div>
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--home-sage-deep)] hover:bg-[var(--home-sage-soft)]"
            aria-label="Back to home"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 p-2" aria-label="Admin sections">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSectionChange(id)
                setMobileNavOpen(false)
              }}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                section === id
                  ? 'bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                  : 'text-[var(--home-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-4 lg:px-8 lg:py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="home-serif text-2xl font-semibold text-[var(--home-heading)]">
              Admin Dashboard
            </h1>
            <p className="text-xs text-[var(--home-muted)]">
              Hidden route — open <code className="text-[var(--home-sage-deep)]">/admin</code> directly.
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-[var(--home-card-border)] px-3 py-2 text-xs font-medium text-[var(--home-muted)] lg:hidden"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? 'Hide menu' : 'Sections'}
          </button>
        </header>

        {saveNotice ? (
          <p className="mb-4 rounded-xl bg-[var(--home-sage-soft)] px-3 py-2 text-sm text-[var(--home-sage-deep)]">
            {saveNotice}
          </p>
        ) : null}

        {children}
      </div>
    </div>
  )
}
