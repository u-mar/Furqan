'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { getChapters } from '@/lib/quran'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/cn'
import type { Chapter, ScopeMode } from '@/types'

type Mode = 'juz' | 'surah' | 'range'

export default function Home() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [mode, setMode] = useState<Mode>('juz')
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [rangeFrom, setRangeFrom] = useState<{ surah: Chapter; ayah: number } | null>(null)
  const [rangeTo, setRangeTo] = useState<{ surah: Chapter; ayah: number } | null>(null)
  const [rangeFromPickerOpen, setRangeFromPickerOpen] = useState(false)
  const [rangeToPickerOpen, setRangeToPickerOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters().then(setChapters).finally(() => setLoading(false))
  }, [])

  const surahMap = useMemo(() => {
    const map = new Map<number, Chapter>()
    chapters.forEach((c) => map.set(c.id, c))
    return map
  }, [chapters])

  const selection = useMemo(() => {
    if (mode === 'juz' && selectedJuz) {
      return {
        label: `Juz ${selectedJuz}`,
        detail: '',
        arabic: '',
      }
    }
    if (mode === 'surah' && selectedSurah) {
      return {
        label: `Surah ${selectedSurah.id}`,
        detail: selectedSurah.englishName,
        arabic: selectedSurah.name,
      }
    }
    if (mode === 'range' && rangeFrom && rangeTo) {
      return {
        label: `Range`,
        detail:
          rangeFrom.surah.id === rangeTo.surah.id
            ? `${rangeFrom.surah.englishName} ${rangeFrom.ayah}–${rangeTo.ayah}`
            : `${rangeFrom.surah.englishName} → ${rangeTo.surah.englishName}`,
        arabic:
          rangeFrom.surah.id === rangeTo.surah.id ? rangeFrom.surah.name : '',
      }
    }
    return null
  }, [mode, selectedJuz, selectedSurah, rangeFrom, rangeTo, surahMap])

  const canBegin = useMemo(() => {
    if (mode === 'range') return rangeFrom && rangeTo && rangeFrom.ayah <= rangeTo.ayah
    return !!selection
  }, [mode, selection, rangeFrom, rangeTo])

  const testHref = useMemo(() => {
    const params = new URLSearchParams({ mode })
    if (mode === 'juz' && selectedJuz) {
      params.set('juz', String(selectedJuz))
    } else if (mode === 'surah' && selectedSurah) {
      params.set('surah', String(selectedSurah.id))
    } else if (mode === 'range' && rangeFrom && rangeTo) {
      params.set('mode', 'range')
      params.set('surah', String(rangeFrom.surah.id))
      params.set('startAyah', String(rangeFrom.ayah))
      params.set('endAyah', String(rangeTo.ayah))
    }
    return `/test?${params.toString()}`
  }, [mode, selectedJuz, selectedSurah, rangeFrom, rangeTo])

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--hifdh-bg)]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-teal-600" />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--hifdh-bg)] text-[var(--hifdh-text)]">
      <div className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-xl font-normal text-[var(--hifdh-text)]">
              Hifdh Practice
            </h1>
            <span className="arabic-text text-2xl font-normal text-teal-600 dark:text-teal-400">
              حفظ
            </span>
          </div>
          <ThemeToggle />
        </header>

        <div className="mb-5 flex gap-0.5 rounded-full bg-stone-200 p-0.5 dark:bg-stone-800">
          {(['juz', 'surah', 'range'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setSelectedJuz(null)
                setSelectedSurah(null)
                setRangeFrom(null)
                setRangeTo(null)
              }}
              className={cn(
                'flex-1 rounded-full py-2 text-sm font-medium transition-colors',
                mode === m
                  ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100'
                  : 'text-stone-500 dark:text-stone-400'
              )}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {mode === 'juz' && (
          <JuzGrid chapters={chapters} selected={selectedJuz} onSelect={setSelectedJuz} />
        )}

        {mode === 'surah' && (
          <SurahList chapters={chapters} selected={selectedSurah} onSelect={setSelectedSurah} />
        )}

        {mode === 'range' && (
          <RangePicker
            chapters={chapters}
            rangeFrom={rangeFrom}
            rangeTo={rangeTo}
            fromOpen={rangeFromPickerOpen}
            toOpen={rangeToPickerOpen}
            onFromChange={setRangeFrom}
            onToChange={setRangeTo}
            onFromToggle={() => {
              setRangeFromPickerOpen(!rangeFromPickerOpen)
              setRangeToPickerOpen(false)
            }}
            onToToggle={() => {
              setRangeToPickerOpen(!rangeToPickerOpen)
              setRangeFromPickerOpen(false)
            }}
            onSelectFrom={(c) => {
              setRangeFrom({ surah: c, ayah: 1 })
              setRangeFromPickerOpen(false)
            }}
            onSelectTo={(c) => {
              setRangeTo({ surah: c, ayah: c.versesCount })
              setRangeToPickerOpen(false)
            }}
          />
        )}

        {selection && (
          <div className="mb-4 rounded-xl border border-teal-200 bg-white px-4 py-3 dark:border-teal-800 dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--hifdh-text)]">{selection.label}</span>
              {selection.arabic && (
                <span className="arabic-text text-base text-teal-600 dark:text-teal-400">
                  {selection.arabic.length > 20 ? selection.arabic.slice(0, 15) + '…' : selection.arabic}
                </span>
              )}
            </div>
            {mode !== 'juz' && selection.detail && (
              <div className="mt-1 text-sm text-[var(--hifdh-muted)]">{selection.detail}</div>
            )}
          </div>
        )}

        <Link
          href={testHref}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-colors',
            canBegin
              ? 'bg-teal-700 text-white hover:bg-teal-800 dark:bg-teal-600 dark:text-stone-950 dark:hover:bg-teal-500'
              : 'cursor-not-allowed bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600'
          )}
        >
          <Play className="h-4 w-4" />
          Begin session
        </Link>
      </div>
    </main>
  )
}

function JuzGrid({
  chapters,
  selected,
  onSelect,
}: {
  chapters: Chapter[]
  selected: number | null
  onSelect: (juz: number) => void
}) {
  return (
    <div className="mb-5 grid grid-cols-6 gap-2">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
        <button
          key={juz}
          onClick={() => onSelect(juz)}
          className={cn(
            'aspect-square rounded-lg text-sm font-medium transition-colors',
            selected === juz
              ? 'bg-teal-700 text-white dark:bg-teal-600 dark:text-stone-950'
              : 'bg-stone-200 text-stone-600 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700'
          )}
        >
          {juz}
        </button>
      ))}
    </div>
  )
}

function SurahList({
  chapters,
  selected,
  onSelect,
}: {
  chapters: Chapter[]
  selected: Chapter | null
  onSelect: (chapter: Chapter) => void
}) {
  return (
    <div className="mb-5 max-h-[340px] overflow-y-auto rounded-xl border border-[var(--hifdh-border)]">
      {chapters.map((chapter) => (
        <button
          key={chapter.id}
          onClick={() => onSelect(chapter)}
          className={cn(
            'flex w-full items-center border-b border-[var(--hifdh-border)] py-3 text-left last:border-b-0',
            selected?.id === chapter.id
              ? 'bg-teal-50 dark:bg-teal-900/20'
              : 'hover:bg-stone-50 dark:hover:bg-stone-800'
          )}
        >
          <span className="w-10 text-right text-xs text-[var(--hifdh-muted)]">{chapter.id}</span>
          <span className="flex-1 truncate text-sm font-medium text-[var(--hifdh-text)]">
            {chapter.englishName}
          </span>
          <span className="mx-2 truncate text-sm text-teal-600 dark:text-teal-400">
            {chapter.name}
          </span>
          <span className="w-10 text-xs text-[var(--hifdh-muted)]">{chapter.versesCount}</span>
        </button>
      ))}
    </div>
  )
}

function RangePicker({
  chapters,
  rangeFrom,
  rangeTo,
  fromOpen,
  toOpen,
  onFromChange,
  onToChange,
  onFromToggle,
  onToToggle,
  onSelectFrom,
  onSelectTo,
}: {
  chapters: Chapter[]
  rangeFrom: { surah: Chapter; ayah: number } | null
  rangeTo: { surah: Chapter; ayah: number } | null
  fromOpen: boolean
  toOpen: boolean
  onFromChange: (v: { surah: Chapter; ayah: number } | null) => void
  onToChange: (v: { surah: Chapter; ayah: number } | null) => void
  onFromToggle: () => void
  onToToggle: () => void
  onSelectFrom: (c: Chapter) => void
  onSelectTo: (c: Chapter) => void
}) {
  const maxAyah = (surah: Chapter) => surah.versesCount

  return (
    <div className="mb-5 space-y-4">
      <div>
        <div className="mb-2 text-xs font-medium uppercase text-[var(--hifdh-muted)]">
          From
        </div>
        <div className="flex gap-2">
          <button
            onClick={onFromToggle}
            className={cn(
              'flex-1 rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-4 py-3 text-left',
              rangeFrom ? 'border-teal-300 dark:border-teal-700' : ''
            )}
          >
            <div className="text-xs text-[var(--hifdh-muted)]">Surah</div>
            <div className="text-sm font-medium text-[var(--hifdh-text)]">
              {rangeFrom ? `${rangeFrom.surah.id}. ${rangeFrom.surah.englishName}` : 'Tap to select'}
            </div>
          </button>
          <input
            type="number"
            min={1}
            max={rangeFrom ? maxAyah(rangeFrom.surah) : 1}
            value={rangeFrom?.ayah || ''}
            onChange={(e) => {
              const val = Math.min(Math.max(1, Number(e.target.value)), rangeFrom ? maxAyah(rangeFrom.surah) : 1)
              onFromChange({ surah: rangeFrom!.surah, ayah: val })
            }}
            disabled={!rangeFrom}
            className="w-20 rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-3 py-3 text-center text-sm text-[var(--hifdh-text)] disabled:opacity-50"
            placeholder="1"
          />
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase text-[var(--hifdh-muted)]">To</div>
        <div className="flex gap-2">
          <button
            onClick={onToToggle}
            className={cn(
              'flex-1 rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-4 py-3 text-left',
              rangeTo ? 'border-teal-300 dark:border-teal-700' : ''
            )}
          >
            <div className="text-xs text-[var(--hifdh-muted)]">Surah</div>
            <div className="text-sm font-medium text-[var(--hifdh-text)]">
              {rangeTo ? `${rangeTo.surah.id}. ${rangeTo.surah.englishName}` : 'Tap to select'}
            </div>
          </button>
          <input
            type="number"
            min={1}
            max={rangeTo ? maxAyah(rangeTo.surah) : 1}
            value={rangeTo?.ayah || ''}
            onChange={(e) => {
              const val = Math.min(Math.max(1, Number(e.target.value)), rangeTo ? maxAyah(rangeTo.surah) : 1)
              onToChange({ surah: rangeTo!.surah, ayah: val })
            }}
            disabled={!rangeTo}
            className="w-20 rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-3 py-3 text-center text-sm text-[var(--hifdh-text)] disabled:opacity-50"
            placeholder="1"
          />
        </div>
      </div>

      {(fromOpen || toOpen) && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--hifdh-border)] bg-[var(--hifdh-surface)]">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => (fromOpen ? onSelectFrom(chapter) : onSelectTo(chapter))}
              className="flex w-full items-center border-b border-[var(--hifdh-border)] py-2 text-left last:border-b-0 hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              <span className="w-8 text-right text-xs text-[var(--hifdh-muted)]">{chapter.id}</span>
              <span className="flex-1 truncate text-sm text-[var(--hifdh-text)]">
                {chapter.englishName}
              </span>
              <span className="mx-2 truncate text-sm text-teal-600">{chapter.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

