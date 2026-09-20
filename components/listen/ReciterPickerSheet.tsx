'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Mic, Search, X } from 'lucide-react'
import HeartButton from '@/components/listen/HeartButton'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { availableQiraat, getQiraat, RECITERS, type QiraatId, type Reciter } from '@/lib/reciters'
import { useT } from '@/lib/i18n'

interface ReciterPickerSheetProps {
  open: boolean
  selectedId: string
  onClose: () => void
  onSelect: (id: string) => void
}

type ListMode = 'all' | 'top' | 'favorites'

const MODES: Array<[ListMode, string]> = [
  ['all', 'All'],
  ['top', 'Top'],
  ['favorites', 'Favourites'],
]

function ReciterRow({
  reciter,
  active,
  detail,
  onSelect,
}: {
  reciter: Reciter
  active: boolean
  detail: string
  onSelect: () => void
}) {
  return (
    <div
      className={cn(
        'flex min-h-[60px] items-center pr-1.5 transition-colors',
        active && 'bg-[color-mix(in_srgb,var(--home-sage)_8%,transparent)]'
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={active || undefined}
        className="ed-focus group flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 pl-3.5 pr-1 text-left"
      >
        <span className="flex transition-transform duration-150 group-active:scale-95">
          <ReciterAvatar reciter={reciter} size={42} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">{reciter.name}</span>
          <span className="mt-px block truncate text-[0.78125rem] text-[var(--home-muted)]">{detail}</span>
        </span>
        {active ? <Check className="h-[18px] w-[18px] shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.6} /> : null}
      </button>
      <HeartButton reciter={reciter} size={40} iconSize={19} />
    </div>
  )
}

function ReciterCard({
  reciters,
  selectedId,
  detail,
  onSelect,
}: {
  reciters: Reciter[]
  selectedId: string
  detail: (reciter: Reciter) => string
  onSelect: (id: string) => void
}) {
  return (
    <div className="home-card overflow-hidden rounded-2xl">
      {reciters.map((reciter, i) => (
        <Fragment key={reciter.id}>
          {i ? <div className="set-row__divider" style={{ marginLeft: 68 }} aria-hidden /> : null}
          <ReciterRow
            reciter={reciter}
            active={reciter.id === selectedId}
            detail={detail(reciter)}
            onSelect={() => onSelect(reciter.id)}
          />
        </Fragment>
      ))}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <h3 className="home-label mx-1 mb-2 mt-[22px]">{children}</h3>
}

export default function ReciterPickerSheet({ open, selectedId, onClose, onSelect }: ReciterPickerSheetProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [qiraat, setQiraat] = useState<QiraatId | 'all'>('all')
  const [mode, setMode] = useState<ListMode>('all')
  const [narrationOpen, setNarrationOpen] = useState(false)
  const { favoriteIds, atLimit, maxFavorites } = useReciterFavorites()

  useEffect(() => {
    if (open) return
    setQuery('')
    setQiraat('all')
    setMode('all')
    setNarrationOpen(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return RECITERS.filter((r) => {
      if (mode === 'favorites' && !favoriteIds.includes(r.id)) return false
      if (mode === 'top' && !r.top) return false
      if (qiraat !== 'all' && r.qiraat !== qiraat) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        getQiraat(r.qiraat).label.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q)
      )
    })
  }, [query, qiraat, mode, favoriteIds])

  const favorites = useMemo(
    () => favoriteIds.map((id) => RECITERS.find((r) => r.id === id)).filter((r): r is Reciter => Boolean(r)),
    [favoriteIds]
  )

  /** Grouped by narration, so the variety of qira'at is visible. */
  const grouped = useMemo(() => {
    const map = new Map<QiraatId, Reciter[]>()
    for (const r of filtered) map.set(r.qiraat, [...(map.get(r.qiraat) ?? []), r])
    return [...map.entries()]
  }, [filtered])

  if (!open) return null

  const choose = (id: string) => {
    tapFeedback()
    onSelect(id)
    onClose()
  }

  const showFavorites = mode === 'all' && favorites.length > 0 && !query.trim() && qiraat === 'all'
  const empty =
    mode === 'favorites' && !query.trim() && qiraat === 'all'
      ? t('No favourites yet. Tap the heart on a reciter to keep them here.')
      : t('No reciter matches that.')

  return (
    <div className="qari-sheet fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]" role="dialog" aria-modal="true" aria-label={t('Choose a reciter')}>
      <div className="shrink-0">
        <div className="mx-auto w-full max-w-lg px-4 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
          <header className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="home-round ed-focus" aria-label={t('Close')}>
              <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="home-serif truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
                {t('Choose a reciter')}</h2>
              <p className="truncate text-[0.8125rem] text-[var(--home-muted)]">
                {t('{count} reciters · {saved} of {max} favourites', { count: RECITERS.length, saved: favoriteIds.length, max: maxFavorites })}</p>
            </div>
          </header>

          <label className="home-card mt-4 flex h-12 items-center gap-2.5 rounded-[14px] px-3.5 focus-within:ring-2 focus-within:ring-[var(--home-sage)]">
            <Search className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputMode="search"
              enterKeyHint="search"
              placeholder={t('Search reciter or narration')}
              aria-label={t('Search reciters')}
              className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="fx-press -mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[var(--home-muted)]"
                aria-label={t('Clear search')}
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            ) : null}
          </label>

          <div className="ed-seg mt-2.5 grid-cols-3">
            {MODES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (mode !== value) tapFeedback()
                  setMode(value)
                }}
                aria-pressed={mode === value}
                className="ed-seg__item ed-focus h-9 text-[0.8125rem] font-semibold"
              >
                {t(label)}
              </button>
            ))}
          </div>

          <div className="home-card mt-2.5 overflow-hidden rounded-2xl">
            <button
              type="button"
              className="set-row"
              onClick={() => {
                tapFeedback()
                setNarrationOpen(true)
              }}
            >
              <span className="set-row__icon" aria-hidden>
                <Mic className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="set-row__label">{t('Narration')}</span>
              <span className="set-row__value">{qiraat === 'all' ? t('All') : getQiraat(qiraat).short}</span>
              <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {showFavorites ? (
            <>
              <Label>{t('Your favourites')}</Label>
              <ReciterCard
                reciters={favorites}
                selectedId={selectedId}
                detail={(r) => `${getQiraat(r.qiraat).short} · ${r.style}`}
                onSelect={choose}
              />
              {atLimit ? (
                <p className="mx-1 mt-2 text-[0.78125rem] text-[var(--home-muted)]">
                  {t('You can keep {max} favourites. Remove one to add another.', { max: maxFavorites })}</p>
              ) : null}
            </>
          ) : null}

          {grouped.map(([qid, list]) => (
            <Fragment key={qid}>
              <Label>
                {getQiraat(qid).label} · {list.length}
              </Label>
              <ReciterCard reciters={list} selectedId={selectedId} detail={(r) => r.style} onSelect={choose} />
            </Fragment>
          ))}

          {grouped.length === 0 ? (
            <p className="home-fade px-6 py-14 text-center text-sm text-[var(--home-muted)]">{empty}</p>
          ) : null}
        </div>
      </div>

      <SettingsSheet open={narrationOpen} title={t('Narration')} onClose={() => setNarrationOpen(false)}>
        <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label={t('Narration')}>
          {[{ id: 'all' as const, label: t('All narrations') }, ...availableQiraat()].map((option, i) => {
            const on = qiraat === option.id
            const count = option.id === 'all' ? RECITERS.length : RECITERS.filter((r) => r.qiraat === option.id).length
            return (
              <div key={option.id}>
                {i ? <div className="set-row__divider" style={{ marginLeft: 14 }} aria-hidden /> : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    tapFeedback()
                    setQiraat(option.id)
                    setNarrationOpen(false)
                  }}
                  className="set-row"
                >
                  <span className="set-row__label">{option.label}</span>
                  <span className="set-row__value tabular-nums">{count}</span>
                  <Radio on={on} />
                </button>
              </div>
            )
          })}
        </div>
      </SettingsSheet>
    </div>
  )
}
