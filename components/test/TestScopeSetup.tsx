'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, Dices, Layers, Search, Sparkles } from 'lucide-react'
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
}

const SCOPE_TABS: { id: ScopeType; label: string; hint: string }[] = [
  { id: 'surah', label: 'Surah', hint: 'One surah' },
  { id: 'juz', label: 'Juz', hint: 'Full juz' },
  { id: 'range', label: 'Range', hint: 'Surah to surah' },
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
        selected ? 'bg-teal-500/15' : 'hover:bg-[var(--app-surface)]'
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
          selected
            ? 'bg-teal-600 text-white'
            : 'bg-[var(--app-surface)] text-[var(--app-muted)]'
        )}
      >
        {chapter.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[var(--app-text)]">
          {chapter.englishName}
        </span>
      </span>
      <span className="shrink-0 arabic-text text-base text-teal-700 dark:text-teal-400">
        {chapter.name}
      </span>
    </button>
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
}: TestScopeSetupProps) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [scope, setScope] = useState<ScopeType>('surah')
  const [query, setQuery] = useState('')
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [rangeFromSurah, setRangeFromSurah] = useState<Chapter | null>(null)
  const [rangeToSurah, setRangeToSurah] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters()
      .then((list) => {
        setChapters(list)
        if (list.length > 0) {
          setSelectedSurah(list[0])
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
    if (scope === 'range' && rangeFromSurah && rangeToSurah) {
      const from = Math.min(rangeFromSurah.id, rangeToSurah.id)
      const to = Math.max(rangeFromSurah.id, rangeToSurah.id)
      return { scope, surah: from, juz: 1, startSurah: from, endSurah: to }
    }
    return {
      scope: 'surah',
      surah: selectedSurah?.id ?? 1,
      juz: 1,
      startSurah: selectedSurah?.id ?? 1,
      endSurah: selectedSurah?.id ?? 1,
    }
  }, [scope, selectedSurah, selectedJuz, rangeFromSurah, rangeToSurah])

  const ready = useMemo(() => {
    if (canStart) return canStart(config)
    if (scope === 'juz') return selectedJuz !== null
    if (scope === 'range') return rangeFromSurah !== null && rangeToSurah !== null
    return selectedSurah !== null
  }, [canStart, config, scope, selectedSurah, selectedJuz, rangeFromSurah, rangeToSurah])

  const href = ready ? buildHref(config) : '#'

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-bg)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-teal-600"
          role="status"
          aria-label="Loading"
        />
      </main>
    )
  }

  return (
    <HomeScreen>
      <header className="mb-5 flex items-center gap-3 border-b border-[var(--home-card-border)] pb-4">
        <Link
          href={backHref}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--app-muted)] transition-colors hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
          aria-label="Go back"
        >
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Dices className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
            <h1 className="truncate text-xl font-bold text-[var(--app-text)]">{title}</h1>
          </div>
          <p className="text-sm text-[var(--app-muted)]">{subtitle}</p>
        </div>
      </header>

      <section className="mb-5 rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-500/15 via-[var(--home-card-bg)] to-[var(--home-card-bg)] p-5 shadow-[var(--home-card-shadow)]">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
          <Sparkles className="h-4 w-4" />
          Smart randomizer
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--app-text)]">Choose your practice area</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--app-muted)]">
          Select a surah, juz, or range. Muyassar will pick ayahs only from that scope.
        </p>
      </section>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
        Test within
      </p>
      <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-1.5 shadow-[var(--home-card-shadow)]">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            className={cn(
              'flex flex-col items-center rounded-xl border px-2 py-3 text-center transition-all',
              scope === tab.id
                ? 'border-teal-500/50 bg-teal-500/15 shadow-sm'
                : 'border-transparent bg-transparent hover:border-teal-500/25 hover:bg-[var(--app-surface)]'
            )}
          >
            <span
              className={cn(
                'text-sm font-semibold',
                scope === tab.id ? 'text-teal-700 dark:text-teal-400' : 'text-[var(--app-text)]'
              )}
            >
              {tab.label}
            </span>
            <span className="mt-0.5 text-[10px] text-[var(--app-muted)]">{tab.hint}</span>
          </button>
        ))}
      </div>

      {(scope === 'surah' || scope === 'range') && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search surah…"
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] py-2.5 pl-10 pr-3 text-sm text-[var(--app-text)] placeholder:text-[var(--app-muted)] focus:border-teal-500/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      )}

      {scope === 'surah' && (
        <div className="mb-4 max-h-[40vh] overflow-y-auto rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]">
          {filtered.map((chapter) => (
            <SurahRow
              key={chapter.id}
              chapter={chapter}
              selected={selectedSurah?.id === chapter.id}
              onSelect={() => setSelectedSurah(chapter)}
            />
          ))}
        </div>
      )}

      {scope === 'juz' && (
        <div className="mb-4 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-3 shadow-[var(--home-card-shadow)]">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--app-muted)]">
            <Layers className="h-3.5 w-3.5" />
            Select a juz (1–30)
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
              <button
                key={juz}
                type="button"
                onClick={() => setSelectedJuz(juz)}
                className={cn(
                  'aspect-square rounded-lg text-sm font-semibold transition-colors',
                  selectedJuz === juz
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'border border-[var(--home-card-border)] bg-[var(--app-surface)] text-[var(--app-text)] hover:border-teal-500/40'
                )}
              >
                {juz}
              </button>
            ))}
          </div>
        </div>
      )}

      {scope === 'range' && (
        <div className="mb-4 space-y-4">
          <div className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-3 shadow-[var(--home-card-shadow)]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              From surah
            </p>
            <div className="max-h-[28vh] overflow-y-auto rounded-xl border border-[var(--home-card-border)]">
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">
              To surah
            </p>
            <div className="max-h-[28vh] overflow-y-auto rounded-xl border border-[var(--home-card-border)]">
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
          {rangeFromSurah && rangeToSurah && (
            <p className="text-center text-xs text-[var(--app-muted)]">
              Testing surahs{' '}
              <span className="font-medium text-[var(--app-text)]">
                {Math.min(rangeFromSurah.id, rangeToSurah.id)}–
                {Math.max(rangeFromSurah.id, rangeToSurah.id)}
              </span>
            </p>
          )}
        </div>
      )}

      {extra}

      <div className="mb-3 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 text-sm shadow-[var(--home-card-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">Selected scope</p>
        <p className="mt-1 font-semibold text-[var(--app-text)]">
          {scope === 'juz'
            ? `Juz ${config.juz}`
            : scope === 'range'
              ? `Surah ${config.startSurah} to ${config.endSurah}`
              : selectedSurah?.englishName ?? `Surah ${config.surah}`}
        </p>
      </div>

      <Link
        href={href}
        onClick={(e) => !ready && e.preventDefault()}
        className={cn(
          'mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold shadow-sm transition-colors',
          ready
            ? 'bg-teal-600 text-white hover:bg-teal-500 active:scale-[0.99]'
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
