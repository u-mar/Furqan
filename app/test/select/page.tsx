'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getChapters } from '@/lib/quran'
import { cn } from '@/lib/cn'
import type { Chapter } from '@/types'

type Mode = 'juz' | 'surah' | 'range'

export default function TestSelectPage() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [mode, setMode] = useState<Mode>('juz')
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<Chapter | null>(null)
  const [rangeFrom, setRangeFrom] = useState<{ surah: Chapter; ayah: number } | null>(null)
  const [rangeTo, setRangeTo] = useState<{ surah: Chapter; ayah: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getChapters().then(setChapters).finally(() => setLoading(false))
  }, [])

  const canBegin = useMemo(() => {
    if (mode === 'range') return rangeFrom && rangeTo && rangeFrom.ayah <= rangeTo.ayah
    if (mode === 'juz') return !!selectedJuz
    return !!selectedSurah
  }, [mode, selectedJuz, selectedSurah, rangeFrom, rangeTo])

  const testHref = useMemo(() => {
    const params = new URLSearchParams({ mode })
    if (mode === 'juz' && selectedJuz) params.set('juz', String(selectedJuz))
    else if (mode === 'surah' && selectedSurah) params.set('surah', String(selectedSurah.id))
    else if (mode === 'range' && rangeFrom && rangeTo) {
      params.set('surah', String(rangeFrom.surah.id))
      params.set('startAyah', String(rangeFrom.ayah))
      params.set('endAyah', String(rangeTo.ayah))
    }
    return `/test?${params.toString()}`
  }, [mode, selectedJuz, selectedSurah, rangeFrom, rangeTo])

  if (loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-700 border-t-teal-500" />
      </main>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-md px-4 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/" className="rounded-full p-2 text-teal-400 hover:bg-white/5">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">Test — choose scope</h1>
        </header>

        <div className="mb-5 flex gap-1 rounded-full bg-[#1a1a1a] p-1">
          {(['juz', 'surah', 'range'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setSelectedJuz(null)
                setSelectedSurah(null)
                setRangeFrom(null)
                setRangeTo(null)
              }}
              className={cn(
                'flex-1 rounded-full py-2 text-sm font-medium capitalize transition-colors',
                mode === m ? 'bg-teal-600 text-white' : 'text-stone-400'
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === 'juz' && (
          <div className="mb-6 grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => (
              <button
                key={juz}
                type="button"
                onClick={() => setSelectedJuz(juz)}
                className={cn(
                  'aspect-square rounded-lg text-sm font-medium',
                  selectedJuz === juz
                    ? 'bg-teal-600 text-white'
                    : 'bg-[#1a1a1a] text-stone-300 hover:bg-[#252525]'
                )}
              >
                {juz}
              </button>
            ))}
          </div>
        )}

        {mode === 'surah' && (
          <div className="mb-6 max-h-[50vh] overflow-y-auto rounded-xl border border-white/10">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setSelectedSurah(chapter)}
                className={cn(
                  'flex w-full items-center border-b border-white/5 px-4 py-3 text-left last:border-0',
                  selectedSurah?.id === chapter.id && 'bg-teal-900/30'
                )}
              >
                <span className="w-8 text-stone-500">{chapter.id}</span>
                <span className="flex-1 font-medium">{chapter.englishName}</span>
                <span className="text-sm text-teal-400">{chapter.name}</span>
              </button>
            ))}
          </div>
        )}

        {mode === 'range' && (
          <p className="mb-6 text-sm text-stone-400">
            Pick surah and ayah range on the home flow — use Juz or Surah for now, or extend this
            screen later.
          </p>
        )}

        <Link
          href={canBegin ? testHref : '#'}
          onClick={(e) => !canBegin && e.preventDefault()}
          className={cn(
            'flex w-full items-center justify-center rounded-xl py-3.5 text-sm font-semibold',
            canBegin
              ? 'bg-teal-600 text-white hover:bg-teal-500'
              : 'bg-[#1a1a1a] text-stone-600'
          )}
        >
          Start test
        </Link>
      </div>
    </main>
  )
}
