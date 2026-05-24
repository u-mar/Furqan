'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import { getChapters } from '@/lib/quran'
import { cn } from '@/lib/cn'
import type { Chapter } from '@/types'

export type ScopeType = 'surah' | 'juz' | 'range'

export interface ScopeConfig {
  scope: ScopeType
  surah: number
  juz: number
  startAyah: number
  endAyah: number
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
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [rangeSurah, setRangeSurah] = useState<Chapter | null>(null)
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters()
      .then((list) => {
        setChapters(list)
        if (list.length > 0) {
          setSelectedSurah(list[0])
          setRangeSurah(list[0])
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (rangeSurah) {
      setRangeEnd((prev) => Math.min(prev, rangeSurah.versesCount))
      setRangeStart((prev) => Math.min(prev, rangeSurah.versesCount))
    }
  }, [rangeSurah])

  const config: ScopeConfig = useMemo(() => {
    if (scope === 'juz') {
      return { scope, surah: 1, juz: selectedJuz ?? 1, startAyah: 1, endAyah: 1 }
    }
    if (scope === 'range' && rangeSurah) {
      return {
        scope,
        surah: rangeSurah.id,
        juz: 1,
        startAyah: rangeStart,
        endAyah: rangeEnd,
      }
    }
    return {
      scope: 'surah',
      surah: selectedSurah?.id ?? 1,
      juz: 1,
      startAyah: 1,
      endAyah: selectedSurah?.versesCount ?? 1,
    }
  }, [scope, selectedSurah, selectedJuz, rangeSurah, rangeStart, rangeEnd])

  const ready = useMemo(() => {
    if (canStart) return canStart(config)
    if (scope === 'juz') return selectedJuz !== null
    if (scope === 'range') {
      return (
        rangeSurah !== null &&
        rangeStart >= 1 &&
        rangeEnd >= rangeStart &&
        rangeEnd <= rangeSurah.versesCount
      )
    }
    return selectedSurah !== null
  }, [canStart, config, scope, selectedSurah, selectedJuz, rangeSurah, rangeStart, rangeEnd])

  const href = ready ? buildHref(config) : '#'

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--app-bg)]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-stone-300 border-t-teal-500 dark:border-stone-700"
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
        <div>
          <h1 className="text-xl font-bold text-[var(--app-text)]">{title}</h1>
          <p className="text-sm text-[var(--app-muted)]">{subtitle}</p>
        </div>
      </header>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--app-muted)]">
        Test within
      </p>
      <div className="mb-4 flex gap-1 rounded-full bg-[var(--app-surface)] p-1">
        {(['surah', 'juz', 'range'] as ScopeType[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={cn(
              'flex-1 rounded-full py-2 text-sm font-medium capitalize transition-colors',
              scope === s
                ? 'bg-teal-600 text-white'
                : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {scope === 'surah' && (
        <div className="mb-4 max-h-[42vh] overflow-y-auto rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] shadow-[var(--home-card-shadow)]">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => setSelectedSurah(chapter)}
              className={cn(
                'flex w-full items-center border-b border-[var(--home-card-border)] px-4 py-3 text-left last:border-0',
                selectedSurah?.id === chapter.id && 'bg-teal-500/10'
              )}
            >
              <span className="w-8 text-sm text-[var(--app-muted)]">{chapter.id}</span>
              <span className="flex-1 font-medium text-[var(--app-text)]">{chapter.englishName}</span>
              <span className="text-sm text-teal-600 dark:text-teal-400">{chapter.name}</span>
            </button>
          ))}
        </div>
      )}

      {scope === 'juz' && (
        <div className="mb-4 grid grid-cols-6 gap-2">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
            <button
              key={juz}
              type="button"
              onClick={() => setSelectedJuz(juz)}
              className={cn(
                'aspect-square rounded-lg text-sm font-medium transition-colors',
                selectedJuz === juz
                  ? 'bg-teal-600 text-white'
                  : 'bg-[var(--home-card-bg)] text-[var(--app-text)] border border-[var(--home-card-border)]'
              )}
            >
              {juz}
            </button>
          ))}
        </div>
      )}

      {scope === 'range' && rangeSurah && (
        <div className="mb-4 space-y-3">
          <label className="block text-xs font-medium text-[var(--app-muted)]">Surah</label>
          <select
            value={rangeSurah.id}
            onChange={(e) => {
              const ch = chapters.find((c) => c.id === Number(e.target.value))
              if (ch) setRangeSurah(ch)
            }}
            className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-2.5 text-[var(--app-text)]"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}. {c.englishName}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">
                From ayah
              </label>
              <input
                type="number"
                min={1}
                max={rangeSurah.versesCount}
                value={rangeStart}
                onChange={(e) => setRangeStart(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-2.5 text-[var(--app-text)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--app-muted)]">
                To ayah
              </label>
              <input
                type="number"
                min={rangeStart}
                max={rangeSurah.versesCount}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-3 py-2.5 text-[var(--app-text)]"
              />
            </div>
          </div>
        </div>
      )}

      {extra}

      <Link
        href={href}
        onClick={(e) => !ready && e.preventDefault()}
        className={cn(
          'flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-semibold transition-colors',
          ready
            ? 'bg-teal-600 text-white hover:bg-teal-500 active:scale-[0.99]'
            : 'cursor-not-allowed bg-[var(--app-surface)] text-[var(--app-muted)]'
        )}
      >
        {startLabel}
      </Link>
    </HomeScreen>
  )
}

export function scopeSearchParams(config: ScopeConfig): URLSearchParams {
  const params = new URLSearchParams({ scope: config.scope })
  if (config.scope === 'juz') {
    params.set('juz', String(config.juz))
  } else {
    params.set('surah', String(config.surah))
    if (config.scope === 'range') {
      params.set('startAyah', String(config.startAyah))
      params.set('endAyah', String(config.endAyah))
    }
  }
  return params
}
