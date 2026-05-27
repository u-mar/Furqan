'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, Dices, Layers, Search } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import { filterChapters } from '@/lib/search-chapters'
import { getChapters } from '@/lib/quran'
import { cn } from '@/lib/cn'
import type { Chapter } from '@/types'

export type ScopeType = 'surah' | 'juz' | 'range'

export interface ScopeConfig {
  scope: ScopeType
  surah: number
  juz: number
  startSurah: number
  endSurah: number
}

interface TestScopeSetupProps {
  title: string
  subtitle: string
  backHref: string
  startLabel: string
  buildHref: (config: ScopeConfig) => string
  extra?: ReactNode
  canStart?: (config: ScopeConfig) => boolean
  /** Which scope tabs to show. Defaults to surah, juz, range. */
  availableScopes?: ScopeType[]
  defaultScope?: ScopeType
}

const ALL_SCOPE_TABS: { id: ScopeType; label: string; hint: string }[] = [
  { id: 'surah', label: 'Surah', hint: 'One surah' },
  { id: 'juz', label: 'Juz', hint: 'Full juz' },
  { id: 'range', label: 'Range', hint: 'Surah selection' },
]

function SurahRow({
  chapter,
  selected,
  onSelect,
}: {
  chapter: Chapter
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 border-b border-[var(--home-card-border)] px-4 py-3 text-left transition-colors last:border-0',
        selected ? 'bg-[var(--home-sage-soft)]' : 'hover:bg-[var(--app-surface)]'
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
          selected
            ? 'bg-[var(--home-sage-deep)] text-white'
            : 'bg-[var(--app-surface)] text-[var(--home-muted)]'
        )}
      >
        {chapter.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[var(--home-heading)]">
          {chapter.englishName}
        </span>
      </span>
      <span className="shrink-0 arabic-text text-base text-[var(--home-sage-deep)]">
        {chapter.name}
      </span>
    </button>
  )
}

function ScopeToggle({
  active,
  onChange,
  options,
}: {
  active: string
  onChange: (id: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div
      className={cn(
        'grid gap-1 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[var(--home-card-shadow)]',
        options.length === 2 ? 'grid-cols-2' : 'grid-cols-1'
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'min-h-[44px] rounded-xl text-sm font-semibold transition-all',
            active === opt.id
              ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
              : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function TestScopeSetup({
  title,
  subtitle,
  backHref,
  startLabel,
  buildHref,
  extra,
  canStart,
  availableScopes = ['surah', 'juz', 'range'],
  defaultScope,
}: TestScopeSetupProps) {
  const scopeTabs = ALL_SCOPE_TABS.filter((t) => availableScopes.includes(t.id))
  const initialScope = defaultScope ?? scopeTabs[0]?.id ?? 'juz'

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [scope, setScope] = useState<ScopeType>(initialScope)
  const [query, setQuery] = useState('')
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [rangeSingleSurah, setRangeSingleSurah] = useState(true)
  const [rangeOneChapter, setRangeOneChapter] = useState<Chapter | null>(null)
  const [rangeFromSurah, setRangeFromSurah] = useState<Chapter | null>(null)
  const [rangeToSurah, setRangeToSurah] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters()
      .then((list) => {
        setChapters(list)
        if (list.length > 0) {
          setSelectedSurah(list[0])
          setRangeOneChapter(list[0])
          setRangeFromSurah(list[0])
          setRangeToSurah(list[0])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => filterChapters(chapters, query), [chapters, query])

  const config: ScopeConfig = useMemo(() => {
    if (scope === 'juz') {
      return {
        scope,
        surah: 1,
        juz: selectedJuz ?? 1,
        startSurah: 1,
        endSurah: 1,
      }
    }
    if (scope === 'range') {
      if (rangeSingleSurah && rangeOneChapter) {
        const id = rangeOneChapter.id
        return { scope, surah: id, juz: 1, startSurah: id, endSurah: id }
      }
      if (rangeFromSurah && rangeToSurah) {
        const from = Math.min(rangeFromSurah.id, rangeToSurah.id)
        const to = Math.max(rangeFromSurah.id, rangeToSurah.id)
        return { scope, surah: from, juz: 1, startSurah: from, endSurah: to }
      }
    }
    return {
      scope: 'surah',
      surah: selectedSurah?.id ?? 1,
      juz: 1,
      startSurah: selectedSurah?.id ?? 1,
      endSurah: selectedSurah?.id ?? 1,
    }
  }, [
    scope,
    selectedSurah,
    selectedJuz,
    rangeSingleSurah,
    rangeOneChapter,
    rangeFromSurah,
    rangeToSurah,
  ])

  const ready = useMemo(() => {
    if (canStart) return canStart(config)
    if (scope === 'juz') return selectedJuz !== null
    if (scope === 'range') {
      if (rangeSingleSurah) return rangeOneChapter !== null
      return rangeFromSurah !== null && rangeToSurah !== null
    }
    return selectedSurah !== null
  }, [
    canStart,
    config,
    scope,
    selectedSurah,
    selectedJuz,
    rangeSingleSurah,
    rangeOneChapter,
    rangeFromSurah,
    rangeToSurah,
  ])

  const scopeSummary = useMemo(() => {
    if (scope === 'juz') return `Juz ${config.juz}`
    if (scope === 'range') {
      if (rangeSingleSurah && rangeOneChapter) {
        return `${rangeOneChapter.englishName} (Surah ${rangeOneChapter.id})`
      }
      const from = Math.min(config.startSurah, config.endSurah)
      const to = Math.max(config.startSurah, config.endSurah)
      return `Surah ${from} to ${to}`
    }
    return selectedSurah?.englishName ?? `Surah ${config.surah}`
  }, [scope, config, rangeSingleSurah, rangeOneChapter, selectedSurah])

  const href = ready ? buildHref(config) : '#'
  const tabCols = scopeTabs.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-bg)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--home-sage-deep)]"
          role="status"
          aria-label="Loading"
        />
      </main>
    )
  }

  return (
    <HomeScreen className="mx-auto max-w-lg">
      <header className="mb-6 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4">
        <Link
          href={backHref}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--home-sage-deep)] transition-colors hover:bg-[var(--home-sage-soft)]"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Dices className="h-5 w-5 shrink-0 text-[var(--home-sage-deep)]" />
            <h1 className="home-serif truncate text-2xl font-semibold text-[var(--home-heading)]">
              {title}
            </h1>
          </div>
          <p className="mt-0.5 text-sm text-[var(--home-muted)]">{subtitle}</p>
        </div>
      </header>

      <h2 className="home-serif mb-3 text-lg font-semibold text-[var(--home-heading)]">Test within</h2>
      <div className={cn('mb-5 grid gap-3', tabCols)}>
        {scopeTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            className={cn(
              'flex min-h-[88px] flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center shadow-[var(--home-card-shadow)] transition-all',
              scope === tab.id
                ? 'border-[var(--home-sage-deep)]/55 bg-[var(--home-sage-soft)]'
                : 'border-[var(--home-card-border)] bg-[var(--home-card-bg)] hover:border-[var(--home-sage-deep)]/30'
            )}
          >
            <span
              className={cn(
                'text-base font-semibold',
                scope === tab.id ? 'text-[var(--home-sage-deep)]' : 'text-[var(--home-heading)]'
              )}
            >
              {tab.label}
            </span>
            <span className="mt-1 text-xs text-[var(--home-muted)]">{tab.hint}</span>
          </button>
        ))}
      </div>

      {scope === 'juz' && (
        <div className="mb-5 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
          <div className="mb-3 flex items-center gap-2 text-sm text-[var(--home-muted)]">
            <Layers className="h-4 w-4 text-[var(--home-sage-deep)]" />
            <span>Select a juz (1–30)</span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
              <button
                key={juz}
                type="button"
                onClick={() => setSelectedJuz(juz)}
                className={cn(
                  'aspect-square rounded-xl text-sm font-semibold transition-colors',
                  selectedJuz === juz
                    ? 'bg-[var(--home-sage-deep)] text-white shadow-sm'
                    : 'border border-[var(--home-card-border)] bg-[var(--app-surface)] text-[var(--home-heading)] hover:border-[var(--home-sage-deep)]/40'
                )}
              >
                {juz}
              </button>
            ))}
          </div>
        </div>
      )}

      {scope === 'range' && (
        <div className="mb-5 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--home-muted)]">How many surahs?</p>
            <ScopeToggle
              active={rangeSingleSurah ? 'one' : 'many'}
              onChange={(id) => setRangeSingleSurah(id === 'one')}
              options={[
                { id: 'one', label: 'One surah' },
                { id: 'many', label: 'Many surahs' },
              ]}
            />
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surah…"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-3 pl-10 pr-3 text-sm text-[var(--home-heading)] placeholder:text-[var(--home-muted)] shadow-[var(--home-card-shadow)] focus:border-[var(--home-sage-deep)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/20"
            />
          </div>

          {rangeSingleSurah ? (
            <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-3 shadow-[var(--home-card-shadow)]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--home-sage-deep)]">
                Choose surah
              </p>
              <div className="max-h-[36vh] overflow-y-auto rounded-xl border border-[var(--home-card-border)]">
                {filtered.map((chapter) => (
                  <SurahRow
                    key={chapter.id}
                    chapter={chapter}
                    selected={rangeOneChapter?.id === chapter.id}
                    onSelect={() => setRangeOneChapter(chapter)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-3 shadow-[var(--home-card-shadow)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--home-sage-deep)]">
                  From surah
                </p>
                <div className="max-h-[24vh] overflow-y-auto rounded-xl border border-[var(--home-card-border)]">
                  {filtered.map((chapter) => (
                    <SurahRow
                      key={`from-${chapter.id}`}
                      chapter={chapter}
                      selected={rangeFromSurah?.id === chapter.id}
                      onSelect={() => setRangeFromSurah(chapter)}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-3 shadow-[var(--home-card-shadow)]">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--home-sage-deep)]">
                  To surah
                </p>
                <div className="max-h-[24vh] overflow-y-auto rounded-xl border border-[var(--home-card-border)]">
                  {filtered.map((chapter) => (
                    <SurahRow
                      key={`to-${chapter.id}`}
                      chapter={chapter}
                      selected={rangeToSurah?.id === chapter.id}
                      onSelect={() => setRangeToSurah(chapter)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {scope === 'surah' && availableScopes.includes('surah') && (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surah…"
              className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] py-3 pl-10 pr-3 text-sm shadow-[var(--home-card-shadow)] focus:border-[var(--home-sage-deep)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--home-sage-deep)]/20"
            />
          </div>
          <div className="mb-5 max-h-[40vh] overflow-y-auto rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]">
            {filtered.map((chapter) => (
              <SurahRow
                key={chapter.id}
                chapter={chapter}
                selected={selectedSurah?.id === chapter.id}
                onSelect={() => setSelectedSurah(chapter)}
              />
            ))}
          </div>
        </>
      )}

      {extra}

      <div className="mb-4 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
          Selected scope
        </p>
        <p className="home-serif mt-1 text-lg font-semibold text-[var(--home-heading)]">{scopeSummary}</p>
      </div>

      <Link
        href={href}
        onClick={(e) => !ready && e.preventDefault()}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold shadow-md transition-all',
          ready
            ? 'bg-[var(--home-sage-deep)] text-white shadow-[rgba(93,122,72,0.25)] hover:brightness-105 active:scale-[0.99]'
            : 'cursor-not-allowed bg-[var(--app-surface)] text-[var(--app-muted)]'
        )}
      >
        {startLabel}
        {ready && <ArrowRight className="h-4 w-4" />}
      </Link>
    </HomeScreen>
  )
}

export function scopeSearchParams(config: ScopeConfig): URLSearchParams {
  const params = new URLSearchParams({ scope: config.scope })
  if (config.scope === 'juz') {
    params.set('juz', String(config.juz))
  } else if (config.scope === 'range') {
    params.set('startSurah', String(config.startSurah))
    params.set('endSurah', String(config.endSurah))
  } else {
    params.set('surah', String(config.surah))
  }
  return params
}
