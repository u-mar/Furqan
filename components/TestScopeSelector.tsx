'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { Chapter, ScopeMode } from '@/types'
import { getChapters } from '@/lib/quran'
import { cn } from '@/lib/cn'

const modeLabel: Record<ScopeMode, string> = {
  surah: 'Surah',
  juz: 'Juz',
  range: 'Range',
}

const modeDesc: Record<ScopeMode, string> = {
  surah: 'All verses in one surah — a random page will be shown.',
  juz: 'Everything in one juz (30 parts) — random pages from across those pages.',
  range: 'A consecutive block of ayahs within one surah — practice specific verses.',
}

export default function TestScopeSelector() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [mode, setMode] = useState<ScopeMode>('surah')
  const [surah, setSurah] = useState(1)
  const [juz, setJuz] = useState(1)
  const [startAyah, setStartAyah] = useState(1)
  const [endAyah, setEndAyah] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadChapters() {
      try {
        const data = await getChapters()
        setChapters(data)
        if (data.length > 0) {
          setEndAyah(data[0].versesCount || 7)
        }
      } catch {
        setError('Could not load Surah list. Retry in a moment.')
      } finally {
        setLoading(false)
      }
    }
    loadChapters()
  }, [])

  const selectedChapter = useMemo(() => chapters.find((c) => c.id === surah), [chapters, surah])
  const maxAyah = selectedChapter?.versesCount || 1

  useEffect(() => {
    if (startAyah > maxAyah) setStartAyah(1)
    if (endAyah > maxAyah) setEndAyah(maxAyah)
    if (endAyah < startAyah) setEndAyah(startAyah)
  }, [maxAyah, startAyah, endAyah])

  const testHref = useMemo(() => {
    const params = new URLSearchParams({ mode })
    if (mode === 'surah') {
      params.set('surah', String(surah))
    } else if (mode === 'juz') {
      params.set('juz', String(juz))
    } else {
      params.set('surah', String(surah))
      params.set('startAyah', String(startAyah))
      params.set('endAyah', String(endAyah))
    }
    return `/test?${params.toString()}`
  }, [mode, surah, juz, startAyah, endAyah])

  if (loading) {
    return (
      <section className="mb-3 rounded-2xl border border-[var(--hifdh-border)] bg-[var(--hifdh-surface)] p-6 text-center text-[var(--hifdh-muted)]">
        Loading Surahs…
      </section>
    )
  }

  return (
    <section className="mb-3 rounded-2xl border border-[var(--hifdh-border)] bg-[var(--hifdh-surface)] p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--hifdh-hint)]">
        Start a session
      </p>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

      <div
        role="group"
        aria-label="Session scope"
        className="mb-4 flex gap-0.5 rounded-lg bg-stone-100 p-0.5 dark:bg-stone-800"
      >
        {(['surah', 'juz', 'range'] as ScopeMode[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={cn(
              'flex-1 rounded-[7px] py-1.5 text-xs transition-colors',
              mode === option
                ? 'bg-white font-medium text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-100'
                : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'
            )}
          >
            {modeLabel[option]}
          </button>
        ))}
      </div>

      <p className="mb-3 text-[13px] text-[var(--hifdh-muted)]">{modeDesc[mode]}</p>

      {(mode === 'surah' || mode === 'range') && (
        <div className="mb-3">
          <label className="mb-2 block text-sm font-medium text-[var(--hifdh-text)]">Surah</label>
          <select
            value={surah}
            onChange={(e) => setSurah(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-4 py-2.5 text-[var(--hifdh-text)] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          >
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.id}. {chapter.englishName} ({chapter.name})
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'juz' && (
        <div className="mb-3">
          <label className="mb-2 block text-sm font-medium text-[var(--hifdh-text)]">Juz</label>
          <select
            value={juz}
            onChange={(e) => setJuz(Number(e.target.value))}
            className="w-full rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-4 py-2.5 text-[var(--hifdh-text)] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
          >
            {Array.from({ length: 30 }, (_, idx) => idx + 1).map((value) => (
              <option key={value} value={value}>
                Juz {value}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'range' && (
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--hifdh-text)]">Start ayah</label>
            <input
              type="number"
              min={1}
              max={maxAyah}
              value={startAyah}
              onChange={(e) => setStartAyah(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-4 py-2.5 text-[var(--hifdh-text)] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--hifdh-text)]">End ayah</label>
            <input
              type="number"
              min={startAyah}
              max={maxAyah}
              value={endAyah}
              onChange={(e) => setEndAyah(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--hifdh-border-md)] bg-[var(--hifdh-surface)] px-4 py-2.5 text-[var(--hifdh-text)] focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
            />
          </div>
        </div>
      )}

      <Link
        href={testHref}
        className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-1 dark:bg-teal-500 dark:text-stone-950 dark:hover:bg-teal-400"
      >
        Begin session
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </section>
  )
}
