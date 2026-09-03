'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Heart, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
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

interface ReciterRowProps {
  reciter: Reciter
  active: boolean
  favorite: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}

function ReciterRow({ reciter, active, favorite, onSelect, onToggleFavorite }: ReciterRowProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors',
        active
          ? 'border-[var(--home-sage-deep)] bg-[var(--home-sage-soft)]'
          : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)]'
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3">
        <ReciterAvatar reciter={reciter} size={46} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--home-heading)]">
            {reciter.name}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--app-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]">
              {reciter.style}
            </span>
            <span className="text-[11px] text-[var(--home-muted)]">
              {getQiraat(reciter.qiraat).short}
            </span>
          </span>
        </span>
        {active && <Check className="h-5 w-5 shrink-0 text-[var(--home-sage-deep)]" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90',
          favorite ? 'text-rose-500' : 'text-[var(--home-muted)] hover:text-rose-400'
        )}
        aria-label={
          favorite ? `Remove ${reciter.name} from favorites` : `Add ${reciter.name} to favorites`
        }
        aria-pressed={favorite}
      >
        <Heart className={cn('h-[18px] w-[18px]', favorite && 'fill-current')} />
      </button>
    </div>
  )
}

export default function ReciterPickerSheet({
  open,
  selectedId,
  onClose,
  onSelect,
}: ReciterPickerSheetProps) {
  const [query, setQuery] = useState('')
  const [qiraat, setQiraat] = useState<QiraatId | 'all'>('all')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const { favoriteIds, isFavorite, toggle } = useReciterFavorites()

  useEffect(() => {
    if (!open) {
      setQuery('')
      setQiraat('all')
      setShowFavoritesOnly(false)
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
      if (showFavoritesOnly && !favoriteIds.includes(r.id)) return false
      if (qiraat !== 'all' && r.qiraat !== qiraat) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        getQiraat(r.qiraat).label.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q)
      )
    })
  }, [query, qiraat, showFavoritesOnly, favoriteIds])

  const favoriteReciters = useMemo(
    () =>
      favoriteIds
        .map((id) => RECITERS.find((r) => r.id === id))
        .filter((r): r is Reciter => Boolean(r)),
    [favoriteIds]
  )

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

  const showFavoritesSection =
    !showFavoritesOnly && favoriteReciters.length > 0 && !query.trim() && qiraat === 'all'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]">
      {/* header */}
      <div className="shrink-0 border-b border-[var(--home-card-border)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="home-serif text-xl font-semibold text-[var(--home-heading)]">
              Choose a reciter
            </h2>
            <p className="text-xs text-[var(--home-muted)]">
              {RECITERS.length} reciters · {favoriteIds.length} favorite
              {favoriteIds.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--home-card-bg)] text-[var(--home-heading)] ring-1 ring-[var(--home-card-border)]"
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

        {/* qira'at filter chips + favorites toggle */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              showFavoritesOnly
                ? 'bg-rose-500 text-white'
                : 'bg-[var(--home-card-bg)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
            )}
            aria-pressed={showFavoritesOnly}
          >
            <Heart className={cn('h-3.5 w-3.5', showFavoritesOnly && 'fill-current')} />
            Favorites
          </button>
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
            {showFavoritesOnly
              ? 'No favorites yet — tap the heart on any reciter to save them here.'
              : 'No reciter matches that search.'}
          </p>
        )}

        {showFavoritesSection && (
          <section className="mb-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-500">
              <Heart className="h-3.5 w-3.5 fill-current" />
              Your favorites
              <span className="font-medium text-[var(--home-muted)]">{favoriteReciters.length}</span>
            </h3>
            <ul className="space-y-2">
              {favoriteReciters.map((r) => (
                <li key={`fav-${r.id}`}>
                  <ReciterRow
                    reciter={r}
                    active={r.id === selectedId}
                    favorite
                    onSelect={() => {
                      onSelect(r.id)
                      onClose()
                    }}
                    onToggleFavorite={() => toggle(r.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {grouped.map(([qid, list]) => (
          <section key={qid} className="mb-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--home-sage-deep)]">
              {getQiraat(qid).label}
              <span className="ml-2 font-medium text-[var(--home-muted)]">{list.length}</span>
            </h3>
            <ul className="space-y-2">
              {list.map((r) => (
                <li key={r.id}>
                  <ReciterRow
                    reciter={r}
                    active={r.id === selectedId}
                    favorite={isFavorite(r.id)}
                    onSelect={() => {
                      onSelect(r.id)
                      onClose()
                    }}
                    onToggleFavorite={() => toggle(r.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
