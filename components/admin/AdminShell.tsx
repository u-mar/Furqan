'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  ChevronLeft,
  Headphones,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Mic,
  RefreshCw,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logoutAdmin } from '@/lib/admin-api'
import { APP_NAME } from '@/lib/app-brand'
import { timeAgo } from '@/components/admin/ui'

export type AdminSection =
  | 'overview'
  | 'users'
  | 'reports'
  | 'feedback'
  | 'recitations'
  | 'verification'
  | 'uploaders'
  | 'listen-qaris'
  | 'daily-verse'
  | 'popups'

type NavItem = { id: AdminSection; label: string; Icon: typeof LayoutDashboard }

const GROUPS: Array<{ label?: string; items: NavItem[] }> = [
  { items: [{ id: 'overview', label: 'Overview', Icon: LayoutDashboard }] },
  {
    label: 'Community',
    items: [
      { id: 'users', label: 'Users', Icon: Users },
      { id: 'reports', label: 'Reports', Icon: AlertTriangle },
      { id: 'feedback', label: 'Feedback', Icon: MessageSquare },
    ],
  },
  {
    label: 'Qari',
    items: [
      { id: 'recitations', label: 'Recitations', Icon: Mic },
      { id: 'verification', label: 'Verification', Icon: BadgeCheck },
      { id: 'uploaders', label: 'Uploaders', Icon: Upload },
    ],
  },
  { label: 'Listen', items: [{ id: 'listen-qaris', label: 'Listen qaris', Icon: Headphones }] },
  {
    label: 'App',
    items: [
      { id: 'daily-verse', label: 'Daily verse', Icon: BookOpen },
      { id: 'popups', label: 'Announcements', Icon: Megaphone },
    ],
  },
]

export const SECTION_TITLES: Record<AdminSection, { title: string; description: string }> = {
  overview: { title: 'Overview', description: 'How Naba is doing, and what needs you.' },
  users: { title: 'Users', description: 'Everyone who has opened the app, guests and accounts.' },
  reports: { title: 'Reports', description: 'Recitations people have reported.' },
  feedback: { title: 'Feedback', description: 'Messages sent from the app.' },
  recitations: { title: 'Recitations', description: 'Every Qari post: hide or remove what should not be there.' },
  verification: { title: 'Verification', description: 'Verified reciters and their applications.' },
  uploaders: { title: 'Uploaders', description: 'Who may post recordings made outside the app.' },
  'listen-qaris': { title: 'Listen qaris', description: 'Verified local reciters and their surahs in Listen.' },
  'daily-verse': { title: 'Daily verse', description: 'The ayah on everyone’s Home screen.' },
  popups: { title: 'Announcements', description: 'A message that pops up in the app.' },
}

export type AdminBadges = Partial<Record<AdminSection, number>>

interface SearchResults {
  people: Array<{ id: string; name: string; detail: string; verified: boolean }>
  recitations: Array<{ id: string; title: string; detail: string }>
  qaris: Array<{ id: string; name: string; detail: string }>
}

function Sidebar({ section, badges, onSectionChange }: { section: AdminSection; badges: AdminBadges; onSectionChange: (s: AdminSection) => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--home-sage-deep)] text-[0.9375rem] font-bold text-white">N</span>
        <div className="min-w-0">
          <p className="text-[0.875rem] font-semibold leading-tight text-[var(--home-heading)]">{APP_NAME} admin</p>
          <p className="truncate text-[0.6875rem] leading-tight text-[var(--home-muted)]">qurannaba.com</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-3" aria-label="Admin sections">
        {GROUPS.map((group, g) => (
          <div key={g} className={g ? 'mt-4' : 'mt-1'}>
            {group.label ? <p className="mb-1 px-2.5 text-[0.65625rem] font-semibold uppercase tracking-[0.08em] text-[var(--home-muted)]">{group.label}</p> : null}
            {group.items.map(({ id, label, Icon }) => {
              const active = section === id
              const badge = badges[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSectionChange(id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'ed-focus flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.84375rem] transition-colors',
                    active
                      ? 'bg-[var(--home-sage-soft)] font-semibold text-[var(--home-sage-deep)]'
                      : 'font-medium text-[var(--home-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]'
                  )}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.9} />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge ? (
                    <span className="flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[0.65625rem] font-bold text-white tabular-nums">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--home-card-border)] px-2.5 py-2.5">
        <Link
          href="/"
          className="ed-focus flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.84375rem] font-medium text-[var(--home-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]"
        >
          <ChevronLeft className="h-[17px] w-[17px]" strokeWidth={1.9} />
          Back to app
        </Link>
        <button
          type="button"
          onClick={() => void logoutAdmin().then(() => window.location.reload())}
          className="ed-focus flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.84375rem] font-medium text-[var(--home-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--home-heading)]"
        >
          <LogOut className="h-[17px] w-[17px]" strokeWidth={1.9} />
          Sign out
        </button>
      </div>
    </>
  )
}

/** The search in the top bar: people, recitations and Listen qaris; choosing one opens its section. */
function GlobalSearch({ onOpen }: { onOpen: (section: AdminSection, query: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { credentials: 'include', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SearchResults | null) => setResults(data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const choose = (section: AdminSection, q: string) => {
    onOpen(section, q)
    setOpen(false)
    setQuery('')
  }
  const empty = results && !results.people.length && !results.recitations.length && !results.qaris.length

  return (
    <div ref={box} className="relative min-w-0 flex-1 sm:max-w-md">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-[var(--home-card-border)] bg-[var(--app-surface)] px-3 focus-within:ring-2 focus-within:ring-[var(--home-sage-deep)]/30">
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--home-muted)]" /> : <Search className="h-4 w-4 shrink-0 text-[var(--home-muted)]" />}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Search people, recitations, qaris…"
          aria-label="Search the admin"
          className="h-full min-w-0 flex-1 bg-transparent text-[0.84375rem] text-[var(--app-text)] outline-none placeholder:text-[var(--home-muted)]"
        />
      </label>
      {open && query.trim().length >= 2 && results ? (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[24rem] overflow-y-auto rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)]">
          {empty ? <p className="px-3 py-4 text-center text-[0.8125rem] text-[var(--home-muted)]">Nothing found for “{query.trim()}”.</p> : null}
          {results.people.length ? <ResultGroup title="People" items={results.people.map((p) => ({ key: p.id, name: p.name, detail: p.detail, onClick: () => choose('users', p.name) }))} /> : null}
          {results.recitations.length ? (
            <ResultGroup title="Recitations" items={results.recitations.map((r) => ({ key: r.id, name: r.title, detail: r.detail, onClick: () => choose('recitations', r.title) }))} />
          ) : null}
          {results.qaris.length ? (
            <ResultGroup title="Listen qaris" items={results.qaris.map((q) => ({ key: q.id, name: q.name, detail: q.detail, onClick: () => choose('listen-qaris', q.name) }))} />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function ResultGroup({ title, items }: { title: string; items: Array<{ key: string; name: string; detail: string; onClick: () => void }> }) {
  return (
    <div className="py-1">
      <p className="px-2.5 pb-1 pt-1.5 text-[0.65625rem] font-semibold uppercase tracking-wider text-[var(--home-muted)]">{title}</p>
      {items.map((item) => (
        <button key={item.key} type="button" onClick={item.onClick} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--app-surface)]">
          <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-medium text-[var(--home-heading)]">{item.name}</span>
          <span className="shrink-0 truncate text-[0.75rem] text-[var(--home-muted)]">{item.detail}</span>
        </button>
      ))}
    </div>
  )
}

export default function AdminShell({
  section,
  onSectionChange,
  badges,
  updatedAt,
  refreshing,
  onRefresh,
  onSearchOpen,
  notice,
  children,
}: {
  section: AdminSection
  onSectionChange: (section: AdminSection) => void
  badges: AdminBadges
  updatedAt: number | null
  refreshing: boolean
  onRefresh: () => void
  onSearchOpen: (section: AdminSection, query: string) => void
  notice?: string
  children: ReactNode
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 15000)
    return () => window.clearInterval(timer)
  }, [])
  const heading = SECTION_TITLES[section]

  return (
    <div className="admin-shell min-h-[100dvh] bg-[var(--app-bg)]">
      <aside className="admin-sidebar hidden lg:flex lg:flex-col">
        <Sidebar section={section} badges={badges} onSectionChange={onSectionChange} />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-black/45" />
          <aside className="admin-sidebar admin-sidebar--drawer relative flex h-full flex-col">
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
              className="ed-focus absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--home-muted)] hover:bg-[var(--app-surface)]"
            >
              <X className="h-4 w-4" />
            </button>
            <Sidebar
              section={section}
              badges={badges}
              onSectionChange={(next) => {
                onSectionChange(next)
                setMenuOpen(false)
              }}
            />
          </aside>
        </div>
      ) : null}

      <div className="admin-main flex min-h-[100dvh] flex-col">
        <header className="admin-topbar flex items-center gap-2.5 px-4 py-2.5 lg:px-7">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="ed-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--home-heading)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch onOpen={onSearchOpen} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="hidden text-[0.75rem] text-[var(--home-muted)] sm:inline">{updatedAt ? `Updated ${timeAgo(updatedAt)}` : 'Loading…'}</span>
            <button
              type="button"
              onClick={onRefresh}
              className="ed-focus flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--home-card-border)] text-[var(--home-heading)] hover:bg-[var(--app-surface)]"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 lg:px-7 lg:py-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-5">
              <h1 className="text-[1.375rem] font-semibold tracking-[-0.01em] text-[var(--home-heading)]">{heading.title}</h1>
              <p className="mt-0.5 text-[0.8125rem] text-[var(--home-muted)]">{heading.description}</p>
            </div>
            {notice ? <p className="mb-4 rounded-lg bg-[var(--home-sage-soft)] px-3 py-2 text-[0.8125rem] font-medium text-[var(--home-sage-deep)]">{notice}</p> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
