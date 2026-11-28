'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronDown, Globe, Search, SlidersHorizontal, UserRound, X } from 'lucide-react'
import HeartButton from '@/components/listen/HeartButton'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import Radio from '@/components/settings/Radio'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useReciterFavorites } from '@/hooks/useReciterFavorites'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { allCountryCodes, countryFlag, countryName } from '@/lib/listen-qaris'
import { allReciters, availableQiraat, getQiraat, type QiraatId, type Reciter } from '@/lib/reciters'
import { useLocalReciters } from '@/lib/verified-reciters'
import { useLanguage, useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'
import { lockPageScroll } from '@/lib/scroll-lock'

interface ReciterPickerSheetProps {
  open: boolean
  /** Which reciters it lists. */
  kind?: ListMode
  selectedId: string
  onClose: () => void
  onSelect: (id: string) => void
}

/** The well-known reciters (Listen's "International reciters"), or the verified local qaris. */
type ListMode = 'international' | 'local'

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
  const t = useT()
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
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">{reciter.name}</span>
            {reciter.local && reciter.country ? <span className="shrink-0 text-[0.9375rem] leading-none">{countryFlag(reciter.country)}</span> : null}
          </span>
          <span className="mt-px block truncate text-[0.78125rem] text-[var(--home-muted)]">{detail}</span>
        </span>
        {active ? <Check className="h-[18px] w-[18px] shrink-0 text-[var(--home-sage-deep)]" strokeWidth={2.6} /> : null}
      </button>
      {reciter.local && reciter.username ? (
        // A verified qari's Qari profile, where they can be followed.
        <Link
          href={`/qari/${encodeURIComponent(reciter.username)}`}
          onClick={() => tapFeedback()}
          className="ed-focus fx-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)]"
          aria-label={t('Open the profile of {name}', { name: reciter.name })}
        >
          <UserRound className="h-[19px] w-[19px]" strokeWidth={2} />
        </Link>
      ) : null}
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

export default function ReciterPickerSheet({ open, kind = 'international', selectedId, onClose, onSelect }: ReciterPickerSheetProps) {
  const t = useT()
  useCloseOnBack(open, onClose)
  const [query, setQuery] = useState('')
  const [qiraat, setQiraat] = useState<QiraatId | 'all'>('all')
  const mode = kind
  const [narrationOpen, setNarrationOpen] = useState(false)
  const [countryOpen, setCountryOpen] = useState(false)
  const [countryQuery, setCountryQuery] = useState('')
  const countryMenu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!countryOpen) return
    const away = (e: PointerEvent) => {
      if (!countryMenu.current?.contains(e.target as Node)) {
        setCountryOpen(false)
        setCountryQuery('')
      }
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setCountryOpen(false)
        setCountryQuery('')
      }
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape, true)
    }
  }, [countryOpen])
  const { favoriteIds, atLimit, maxFavorites } = useReciterFavorites()
  const locals = useLocalReciters()
  const language = useLanguage()
  /** Local mode's country: the viewer's own when someone there is verified, else every country. */
  const [country, setCountry] = useState<string>('all')
  const reciters = allReciters()
  /** The reciters this list is of: the verified local qaris, or the well-known ones. */
  const listReciters = useMemo(() => reciters.filter((r) => Boolean(r.local) === (kind === 'local')), [reciters, kind])
  const countries = useMemo(() => {
    const present = [...new Set(locals.reciters.map((r) => r.country).filter((c): c is string => Boolean(c)))]
    return present.sort((a, b) => (a === locals.country ? -1 : b === locals.country ? 1 : a.localeCompare(b)))
  }, [locals])

  useEffect(() => {
    if (open) return
    setQuery('')
    setQiraat('all')
    setNarrationOpen(false)
    setCountryOpen(false)
    setCountryQuery('')
  }, [open])

  // The local list opens on the viewer's own country when someone there is verified.
  useEffect(() => {
    if (open) setCountry(kind === 'local' && locals.country && countries.includes(locals.country) ? locals.country : 'all')
    // Only when it opens: a country chosen after that stays.
  }, [open, kind])

  useEffect(() => {
    if (!open) return
    const unlockScroll = lockPageScroll()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlockScroll()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return reciters.filter((r) => {
      if (mode === 'international' && r.local) return false
      if (mode === 'local' && (!r.local || (country !== 'all' && r.country !== country))) return false
      if (qiraat !== 'all' && r.qiraat !== qiraat) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.nameAr ?? '').includes(query.trim()) ||
        (r.city ?? '').toLowerCase().includes(q) ||
        getQiraat(r.qiraat).label.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q)
      )
    })
  }, [query, qiraat, mode, reciters, country])

  const favorites = useMemo(
    () =>
      favoriteIds
        .map((id) => reciters.find((r) => r.id === id))
        .filter((r): r is Reciter => Boolean(r) && Boolean(r?.local) === (mode === 'local')),
    [favoriteIds, reciters, mode]
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

  const showFavorites = favorites.length > 0 && !query.trim() && qiraat === 'all' && (mode === 'international' || country === 'all')
  const empty =
    mode === 'local' && !locals.reciters.length
        ? t('Verified local reciters will appear here.')
        : mode === 'local' && country !== 'all' && !query.trim()
          ? t('No verified reciters from {country} yet.', { country: countryName(country, language) })
        : t('No reciter matches that.')
  /** "Mogadishu, Somalia" for a verified qari. */
  const localDetail = (r: Reciter) => {
    if (!r.local) return null
    return [r.city, r.country ? countryName(r.country, language) : null].filter(Boolean).join(', ') || null
  }

  return (
    <div className="reciter-picker qari-sheet fixed inset-0 z-50 flex flex-col bg-[var(--app-bg)]" role="dialog" aria-modal="true" aria-label={t('Choose a reciter')}>
      <div className="relative z-20 shrink-0">
        <div className="mx-auto w-full max-w-lg px-4 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
          <header className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="home-round ed-focus" aria-label={t('Close')}>
              <X className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="home-serif truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--home-heading)]">
                {t('Choose a reciter')}</h2>
              <p className="truncate text-[0.8125rem] text-[var(--home-muted)]">
                {(() => {
                  const count = reciters.filter((r) => Boolean(r.local) === (mode === 'local')).length
                  const values = { count, saved: favoriteIds.filter((id) => id.startsWith('naba_') === (mode === 'local')).length, max: maxFavorites }
                  return count === 1 ? t('1 reciter · {saved} of {max} favourites', values) : t('{count} reciters · {saved} of {max} favourites', values)
                })()}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setNarrationOpen(true)
              }}
              className="home-round ed-focus relative"
              aria-label={qiraat === 'all' ? t('Narration') : `${t('Narration')}: ${getQiraat(qiraat).short}`}
            >
              <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.9} />
              {qiraat !== 'all' ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--home-sage)]" aria-hidden />
              ) : null}
            </button>
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

          {mode === 'local' ? (
            <div ref={countryMenu} className="relative mt-2.5 w-fit">
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  setCountryOpen((v) => !v)
                }}
                className="home-card ed-focus fx-press flex h-10 items-center gap-2 rounded-full px-3.5 text-[0.8125rem] font-semibold text-[var(--home-heading)]"
                aria-label={`${t('Country')}: ${country === 'all' ? t('All countries') : countryName(country, language)}`}
                aria-expanded={countryOpen}
              >
                {country === 'all' ? (
                  <Globe className="h-4 w-4 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
                ) : (
                  <span className="text-[0.9375rem] leading-none" aria-hidden>
                    {countryFlag(country)}
                  </span>
                )}
                {country === 'all' ? t('All countries') : countryName(country, language)}
                <ChevronDown className="h-4 w-4 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
              </button>
              {countryOpen ? (
                <div className="qari-enter absolute left-0 top-full z-30 mt-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-[var(--home-rule)] bg-[var(--home-card-bg)] p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)]">
                <label className="home-card mb-2 flex h-10 items-center gap-2.5 rounded-[14px] px-3.5 focus-within:ring-2 focus-within:ring-[var(--home-sage)]">
                  <Search className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
                  <input
                    value={countryQuery}
                    onChange={(e) => setCountryQuery(e.target.value)}
                    inputMode="search"
                    enterKeyHint="search"
                    placeholder={t('Search country')}
                    aria-label={t('Search country')}
                    className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
                  />
                </label>
                <div className="max-h-[min(20rem,55dvh)] overflow-y-auto overscroll-contain rounded-xl" role="radiogroup" aria-label={t('Country')}>
                  {(() => {
                    const q = countryQuery.trim().toLowerCase()
                    const counts = new Map<string, number>()
                    for (const r of locals.reciters) if (r.country) counts.set(r.country, (counts.get(r.country) ?? 0) + 1)
                    const others = allCountryCodes()
                      .filter((code) => !counts.has(code))
                      .sort((a, b) => countryName(a, language).localeCompare(countryName(b, language), language))
                    const options = ['all', ...countries, ...others].filter(
                      (code) =>
                        !q ||
                        (code === 'all'
                          ? t('All countries').toLowerCase().includes(q)
                          : countryName(code, language).toLowerCase().includes(q) || countryName(code).toLowerCase().includes(q) || code.toLowerCase() === q)
                    )
                    if (!options.length) return <p className="px-4 py-6 text-center text-sm text-[var(--home-muted)]">{t('No country matches that.')}</p>
                    return options.map((code, i) => {
                      const on = country === code
                      const count = code === 'all' ? locals.reciters.length : counts.get(code) ?? 0
                      return (
                        <div key={code}>
                          {i ? <div className="set-row__divider" style={{ marginLeft: 14 }} aria-hidden /> : null}
                          <button
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => {
                              tapFeedback()
                              setCountry(code)
                              setCountryOpen(false)
                              setCountryQuery('')
                            }}
                            className="set-row"
                          >
                            <span className="set-row__label flex items-center gap-2">
                              {code === 'all' ? (
                                <Globe className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
                              ) : (
                                <span className="shrink-0 text-[1rem] leading-none" aria-hidden>
                                  {countryFlag(code)}
                                </span>
                              )}
                              {code === 'all' ? t('All countries') : countryName(code, language)}
                            </span>
                            {count ? <span className="set-row__value tabular-nums">{count}</span> : null}
                            <Radio on={on} />
                          </button>
                        </div>
                      )
                    })
                  })()}
                </div>
                </div>
              ) : null}
            </div>
          ) : null}
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
                detail={(r) => localDetail(r) ?? `${getQiraat(r.qiraat).short} · ${r.style}`}
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
              <ReciterCard reciters={list} selectedId={selectedId} detail={(r) => localDetail(r) ?? r.style} onSelect={choose} />
            </Fragment>
          ))}

          {grouped.length === 0 ? (
            <p className="home-fade px-6 py-14 text-center text-sm text-[var(--home-muted)]">{empty}</p>
          ) : null}
        </div>
      </div>

      <SettingsSheet open={narrationOpen} title={t('Narration')} onClose={() => setNarrationOpen(false)}>
        <div className="overflow-hidden rounded-2xl border border-[var(--home-rule)]" role="radiogroup" aria-label={t('Narration')}>
          {[{ id: 'all' as const, label: t('All narrations') }, ...availableQiraat().filter((q) => listReciters.some((r) => r.qiraat === q.id))].map((option, i) => {
            const on = qiraat === option.id
            // Counted in this list only: the local qaris, or the well-known reciters.
            const count = option.id === 'all' ? listReciters.length : listReciters.filter((r) => r.qiraat === option.id).length
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
