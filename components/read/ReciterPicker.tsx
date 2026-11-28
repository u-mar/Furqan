'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAppSettings } from '@/lib/app-settings'
import { tapFeedback } from '@/lib/haptics'
import { useCloseOnBack } from '@/lib/native-back'
import { ayahCapableReciters, getQiraat, RECITERS } from '@/lib/reciters'
import { lockPageScroll } from '@/lib/scroll-lock'
import { useT } from '@/lib/i18n'

interface ReciterPickerProps {
  reciterId: string
  className?: string
}

/**
 * Read's reciter: the button in the dock, and the full page it opens to choose another, with a search
 * at the top. Only reciters whose recitation can follow the page ayah by ayah are offered.
 */
export default function ReciterPicker({ reciterId, className }: ReciterPickerProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const current = RECITERS.find((r) => r.id === reciterId) ?? RECITERS[0]

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          tapFeedback()
          setOpen(true)
        }}
        className="mushaf-dock-select"
        aria-label={`${t('Choose reciter')}: ${current.name}`}
        aria-haspopup="dialog"
      >
        <span className="mushaf-dock-select__caption">{t('Reciter')}</span>
        <span className="mushaf-dock-select__value">
          <span className="truncate">{current.name}</span>
          <ChevronDown className="mushaf-dock-select__chevron h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
      </button>
      {open ? <ReciterPage reciterId={reciterId} onClose={() => setOpen(false)} /> : null}
    </div>
  )
}

function ReciterPage({ reciterId, onClose }: { reciterId: string; onClose: () => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  useCloseOnBack(true, onClose)

  useEffect(() => {
    const unlock = lockPageScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const reciters = useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = ayahCapableReciters()
    if (!q) return all
    return all.filter(
      (r) => r.name.toLowerCase().includes(q) || getQiraat(r.qiraat).label.toLowerCase().includes(q) || r.style.toLowerCase().includes(q)
    )
  }, [query])

  const choose = (id: string) => {
    tapFeedback()
    setAppSettings({ reciterId: id })
    onClose()
  }

  // On the page itself, not inside the dock, so nothing around the dock can clip or shift it.
  return createPortal(
    <div className="qari-sheet fixed inset-0 z-[80] flex flex-col bg-[var(--app-bg)] text-[var(--app-text)]" role="dialog" aria-modal="true" aria-label={t('Choose reciter')}>
      <div className="shrink-0">
        <div className="mx-auto w-full max-w-lg px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
          <header className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="home-round ed-focus" aria-label={t('Close')}>
              <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
            <h2 className="home-serif min-w-0 flex-1 truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
              {t('Choose reciter')}
            </h2>
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
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-lg px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
          {reciters.length ? (
            <ul className="home-card overflow-hidden rounded-2xl" role="listbox" aria-label={t('Choose reciter')}>
              {reciters.map((r, i) => {
                const on = r.id === reciterId
                return (
                  <li key={r.id}>
                    {i ? <div className="set-row__divider" style={{ marginLeft: 14 }} aria-hidden /> : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => choose(r.id)}
                      className={cn(
                        'ed-focus flex min-h-[56px] w-full items-center gap-3 py-2 pl-4 pr-4 text-left transition-colors',
                        on && 'bg-[color-mix(in_srgb,var(--home-sage)_8%,transparent)]'
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">{r.name}</span>
                        <span className="mt-px block truncate text-[0.78125rem] text-[var(--home-muted)]">
                          {getQiraat(r.qiraat).short} · {r.style}
                        </span>
                      </span>
                      {on ? <Check className="h-[18px] w-[18px] shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.6} /> : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-6 py-14 text-center text-sm text-[var(--home-muted)]">{t('No reciter matches that.')}</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
