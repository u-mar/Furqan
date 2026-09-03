'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import {
  availableQiraat,
  getQiraat,
  RECITERS,
  type QiraatId,
  type Reciter,
} from '@/lib/reciters'

interface ReciterPickerSheetProps {
  open: boolean
  selectedId: string
  onClose: () => void
  onSelect: (id: string) => void
}

export default function ReciterPickerSheet({
  open,
  selectedId,
  onClose,
  onSelect,
}: ReciterPickerSheetProps) {
  const [query, setQuery] = useState('')
  const [qiraat, setQiraat] = useState<QiraatId | 'all'>('all')

  useEffect(() => {
    if (!open) {
      setQuery('')
      setQiraat('all')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return RECITERS.filter((r) => {
      if (qiraat !== 'all' && r.qiraat !== qiraat) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        getQiraat(r.qiraat).label.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q)
      )
    })
  }, [query, qiraat])

  /** Group by narration so the qira'at variety is visible. */
  const grouped = useMemo(() => {
    const map = new Map<QiraatId, Reciter[]>()
    for (const r of filtered) {
      const list = map.get(r.qiraat) ?? []
      list.push(r)
      map.set(r.qiraat, list)
    }
    return [...map.entries()]
  }, [filtered])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]">
      {/* header */}
      <div className="shrink-0 border-b border-[var(--home-card-border)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="home-serif text-xl font-semibold text-[var(--home-heading)]">
            Choose a reciter
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--home-card-bg)] text-[var(--home-heading)] ring-1 ring-[var(--home-card-border)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reciter or narration…"
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/30"
          />
        </div>

        {/* qira'at filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setQiraat('all')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              qiraat === 'all'
                ? 'bg-[var(--home-sage-deep)] text-white'
                : 'bg-[var(--home-card-bg)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
            )}
          >
            All qira&apos;at
          </button>
          {availableQiraat().map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setQiraat(q.id)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                qiraat === q.id
                  ? 'bg-[var(--home-sage-deep)] text-white'
                  : 'bg-[var(--home-card-bg)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
              )}
            >
              {q.short}
            </button>
          ))}
        </div>
      </div>

      {/* list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-[var(--home-muted)]">
            No reciter matches that search.
          </p>
        )}

        {grouped.map(([qid, list]) => (
          <section key={qid} className="mb-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--home-sage-deep)]">
              {getQiraat(qid).label}
              <span className="ml-2 font-medium text-[var(--home-muted)]">{list.length}</span>
            </h3>
            <ul className="space-y-2">
              {list.map((r) => {
                const active = r.id === selectedId
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(r.id)
                        onClose()
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)]'
                          : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)]'
                      )}
                    >
                      <ReciterAvatar reciter={r} size={46} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--home-heading)]">
                          {r.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-[var(--app-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]">
                            {r.style}
                          </span>
                          <span className="text-[11px] text-[var(--home-muted)]">
                            {getQiraat(r.qiraat).short}
                          </span>
                        </span>
                      </span>
                      {active && (
                        <Check className="h-5 w-5 shrink-0 text-[var(--home-sage-deep)]" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
