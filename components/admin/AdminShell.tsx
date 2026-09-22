'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Menu,
  Shield,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logoutAdmin } from '@/lib/admin-api'
import { APP_NAME } from '@/lib/app-brand'

export type AdminSection = 'overview' | 'daily-verse' | 'feedback' | 'users' | 'popups' | 'reports'

const NAV: { id: AdminSection; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'reports', label: 'Reports', Icon: AlertTriangle },
  { id: 'daily-verse', label: 'Daily Verse', Icon: Megaphone },
  { id: 'feedback', label: 'Feedback', Icon: MessageSquare },
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'popups', label: 'Popups', Icon: Megaphone },
]

const SECTION_TITLES: Record<AdminSection, string> = {
  overview: 'Overview',
  reports: 'Reported recitations',
  'daily-verse': 'Daily verse',
  feedback: 'Feedback inbox',
  users: 'Users & presence',
  popups: 'In-app popup',
}

interface AdminShellProps {
  section: AdminSection
  onSectionChange: (section: AdminSection) => void
  saveNotice: string
  /** Shown as a badge on "Reports" in the nav — how many need a look. */
  reportCount?: number
  children: ReactNode
}

function SidebarContent({
  section,
  onSectionChange,
  reportCount,
}: {
  section: AdminSection
  onSectionChange: (section: AdminSection) => void
  reportCount: number
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-deep)] text-white">
          <Shield className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-[var(--home-heading)]">Admin</p>
          <p className="truncate text-[11px] leading-tight text-[var(--home-muted)]">{APP_NAME}</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Admin sections">
        {NAV.map(({ id, label, Icon }) => {
          const active = section === id
          const badge = id === 'reports' && reportCount > 0 ? reportCount : null
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'ed-focus flex items-center gap-3 rounded-xl border-l-[3px] px-2.5 py-2.5 text-left text-sm font-medium transition-colors',
                active
                  ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                  : 'border-transparent text-[var(--home-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]'
              )}
            >
              <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.9} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10.5px] font-bold text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-[var(--home-card-border)] px-3 py-3">
        <button
          type="button"
          onClick={() => void logoutAdmin().then(() => window.location.reload())}
          className="ed-focus flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]"
        >
          <LogOut className="h-[17px] w-[17px]" strokeWidth={1.9} />
          Sign out
        </button>
        <Link
          href="/"
          className="ed-focus flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--home-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={1.9} />
          Back to app
        </Link>
      </div>
    </>
  )
}

export default function AdminShell({
  section,
  onSectionChange,
  saveNotice,
  reportCount = 0,
  children,
}: AdminShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="admin-shell min-h-[100dvh] bg-[var(--app-bg)]">
      {/* Sidebar — fixed on desktop, a slide-over drawer on phone/tablet. */}
      <aside className="admin-sidebar hidden lg:flex lg:flex-col">
        <SidebarContent section={section} onSectionChange={onSectionChange} reportCount={reportCount} />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <aside className="admin-sidebar admin-sidebar--drawer relative flex h-full w-[15.5rem] flex-col">
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close menu"
              className="ed-focus absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--home-muted)] hover:bg-[var(--app-surface)]"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              section={section}
              onSectionChange={(next) => {
                onSectionChange(next)
                setMobileNavOpen(false)
              }}
              reportCount={reportCount}
            />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="admin-main flex min-h-[100dvh] flex-col">
        <header className="admin-topbar flex items-center gap-3 px-4 py-3.5 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="ed-focus flex h-9 w-9 items-center justify-center rounded-lg text-[var(--home-heading)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="home-serif truncate text-[1.375rem] font-semibold tracking-[-0.01em] text-[var(--home-heading)]">
              {SECTION_TITLES[section]}
            </h1>
            <p className="hidden text-[11px] text-[var(--home-muted)] sm:block">
              Users refresh every 20s · online = active in the last 90 seconds
            </p>
          </div>
        </header>

        <div className="min-w-0 flex-1 px-4 py-5 lg:px-8 lg:py-7">
          {saveNotice ? (
            <p className="mb-4 rounded-xl bg-[var(--home-sage-soft)] px-3 py-2 text-sm text-[var(--home-sage-deep)]">
              {saveNotice}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  )
}
