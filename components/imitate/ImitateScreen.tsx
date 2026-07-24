'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Mic, Search, Sparkles, Trophy } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import SurahSearchModal from '@/components/read/SurahSearchModal'
import { useAppSettings } from '@/hooks/useAppSettings'
import { setAppSettings } from '@/lib/app-settings'
import { RECITERS, isSurahOnlyReciter } from '@/lib/reciters'
import { getChapters, getVersesByChapter } from '@/lib/quran'
import { getImitateStats, getRecentPractice, type ImitateStats } from '@/lib/imitate-progress'
import type { PracticeRecord } from '@/lib/imitate-progress'
import type { Chapter } from '@/types'
import { cn } from '@/lib/cn'

const QUICK_SURAHS = [
  { id: 1, label: 'Al-Fatiha', subtitle: '7 ayahs · great to start' },
  { id: 112, label: 'Al-Ikhlas', subtitle: '4 ayahs' },
  { id: 114, label: 'An-Nas', subtitle: '6 ayahs' },
  { id: 36, label: 'Ya-Sin', subtitle: '83 ayahs' },
] as const

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

function scoreTint(value: number): string {
  if (value >= 80) return 'text-emerald-500'
  if (value >= 60) return 'text-[var(--home-sage-deep)]'
  if (value >= 40) return 'text-amber-500'
  return 'text-[var(--home-muted)]'
}

export default function ImitateScreen() {
  const settings = useAppSettings()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pickedSurah, setPickedSurah] = useState<number | null>(null)
  const [ayahCount, setAyahCount] = useState(0)
  const [loadingAyahs, setLoadingAyahs] = useState(false)
  const [recent, setRecent] = useState<PracticeRecord[]>([])
  const [stats, setStats] = useState<ImitateStats | null>(null)

  const imitateReciters = RECITERS.filter((r) => !isSurahOnlyReciter(r))
  const currentReciter =
    imitateReciters.find((r) => r.id === settings.reciterId) ?? imitateReciters[0]
  const pickedChapter = chapters.find((c) => c.id === pickedSurah)

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => {})
      .finally(() => setLoadingChapters(false))
    setRecent(getRecentPractice(4))
    setStats(getImitateStats())
  }, [])

  useEffect(() => {
    if (!pickedSurah) {
      setAyahCount(0)
      return
    }
    setLoadingAyahs(true)
    getVersesByChapter(pickedSurah)
      .then((verses) => setAyahCount(verses.length))
      .catch(() => setAyahCount(0))
      .finally(() => setLoadingAyahs(false))
  }, [pickedSurah])

  function handleSurahPick(id: number) {
    setSearchOpen(false)
    setPickedSurah(id)
  }

  const hasProgress = stats && stats.totalAttempts > 0

  return (
    <HomeScreen className="max-w-lg mx-auto">
      {/* Hero header */}
      <header className="reveal mb-6">
        <div
          className="gold-sheen relative overflow-hidden rounded-[1.9rem] px-5 pb-5 pt-4 text-white shadow-[0_26px_60px_-20px_rgba(58,42,128,0.85)] ring-1 ring-white/10"
          style={{ background: 'var(--home-sage-gradient)' }}
        >
          <div
            className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-[#e2ab53]/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-[#6a4bd0]/40 blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <Link
              href="/"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl bg-white/12 text-white ring-1 ring-white/15 backdrop-blur-sm transition-all hover:bg-white/22 active:scale-95"
              aria-label="Back home"
            >
              <ChevronLeft className="h-6 w-6" />
            </Link>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15">
              <Mic className="h-6 w-6 text-white" />
            </span>
            <div>
              <h1 className="home-serif text-2xl font-semibold leading-tight text-white drop-shadow-sm">
                Imitate
              </h1>
              <p className="text-xs text-white/70">Learn to recite like the shuyukh</p>
            </div>
          </div>

          {/* Skill level */}
          {hasProgress && stats && (
            <div className="relative mt-4 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/12 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <Trophy className="h-4 w-4 text-[#f4d59b]" />
                  {stats.level.name}
                </span>
                <span className="text-xs font-medium text-white/70">
                  {stats.nextLevel ? `Next: ${stats.nextLevel.name}` : 'Top level reached'}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#f4d59b] to-[#e2ab53] transition-all duration-700"
                  style={{ width: `${stats.progressToNext}%` }}
                />
              </div>
              <div className="mt-2 flex gap-4 text-[11px] text-white/70">
                <span>
                  <strong className="text-white">{stats.avgBest}%</strong> avg best
                </span>
                <span>
                  <strong className="text-white">{stats.distinctAyahs}</strong> ayahs
                </span>
                <span>
                  <strong className="text-white">{stats.totalAttempts}</strong> attempts
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Reciter picker */}
      <section
        className="reveal mb-6 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]"
        style={{ animationDelay: '80ms' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
            Choose a reciter to imitate
          </p>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {imitateReciters.map((r) => {
            const active = r.id === settings.reciterId
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setAppSettings({ reciterId: r.id })}
                className={cn(
                  'flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors',
                  active && 'bg-[var(--home-sage-soft)]'
                )}
              >
                <span
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold transition-all',
                    active
                      ? 'bg-gradient-to-br from-[#f4d59b] to-[#e2ab53] text-[#2a2258] shadow-[0_8px_20px_-8px_rgba(226,171,83,0.85)] ring-2 ring-[var(--home-sage)]'
                      : 'bg-[var(--app-surface)] text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]'
                  )}
                >
                  {initialsOf(r.name)}
                </span>
                <span
                  className={cn(
                    'line-clamp-2 text-center text-[10px] font-medium leading-tight',
                    active ? 'text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
                  )}
                >
                  {r.name.split(' ').slice(-1)[0]}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--home-muted)]">
          <Sparkles className="h-3.5 w-3.5 text-[var(--home-sage-deep)]" />
          Practicing with{' '}
          <span className="font-semibold text-[var(--home-heading)]">{currentReciter.name}</span>
        </p>
      </section>

      {!pickedSurah ? (
        <>
          <section className="reveal mb-6" style={{ animationDelay: '140ms' }}>
            <h2 className="home-serif mb-3 text-lg font-semibold text-[var(--home-heading)]">
              Quick start
            </h2>
            <ul className="space-y-2.5">
              {QUICK_SURAHS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setPickedSurah(s.id)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3.5 text-left shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--home-sage-soft)] text-sm font-bold text-[var(--home-sage-deep)]">
                      {s.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--home-heading)]">{s.label}</p>
                      <p className="text-xs text-[var(--home-muted)]">{s.subtitle}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--home-muted)] transition-transform group-active:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            disabled={loadingChapters}
            className="reveal mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--home-sage)]/40 bg-[var(--home-sage-soft)] px-4 py-4 text-sm font-semibold text-[var(--home-sage-deep)] transition-transform active:scale-[0.99]"
            style={{ animationDelay: '200ms' }}
          >
            <Search className="h-4 w-4" />
            Search all 114 surahs
          </button>

          {recent.length > 0 && (
            <section className="reveal" style={{ animationDelay: '260ms' }}>
              <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
                Continue practicing
              </h2>
              <ul className="space-y-2.5">
                {recent.map((r) => (
                  <li key={`${r.reciterId}-${r.surah}-${r.ayah}-${r.practicedAt}`}>
                    <Link
                      href={`/imitate/${r.surah}/${r.ayah}`}
                      className="flex items-center gap-3 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--app-surface)] text-xs font-bold text-[var(--home-muted)] ring-1 ring-[var(--home-card-border)]">
                        {r.surah}:{r.ayah}
                      </span>
                      <span className="min-w-0 flex-1 text-[var(--home-heading)]">
                        Surah {r.surah} · Ayah {r.ayah}
                        <span className="block text-xs text-[var(--home-muted)]">
                          {r.attempts} attempt{r.attempts === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="flex flex-col items-end">
                        <span className={cn('text-sm font-bold', scoreTint(r.bestVoiceSimilarity))}>
                          {r.bestVoiceSimilarity}%
                        </span>
                        <span className="text-[10px] text-[var(--home-muted)]">best</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="reveal rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
          <button
            type="button"
            onClick={() => setPickedSurah(null)}
            className="mb-3 flex items-center gap-1 text-sm font-semibold text-[var(--home-sage-deep)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <h2 className="home-serif mb-1 text-lg font-semibold text-[var(--home-heading)]">
            {pickedChapter?.englishName ?? `Surah ${pickedSurah}`}
          </h2>
          <p className="mb-4 text-sm text-[var(--home-muted)]">Tap an ayah to practice</p>

          {loadingAyahs ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--home-sage)]" />
            </div>
          ) : (
            <ul className="grid grid-cols-5 gap-2">
              {Array.from({ length: ayahCount }, (_, i) => i + 1).map((ayah) => (
                <li key={ayah}>
                  <Link
                    href={`/imitate/${pickedSurah}/${ayah}`}
                    className="flex h-11 items-center justify-center rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-sage-soft)] hover:text-[var(--home-sage-deep)] active:scale-95"
                  >
                    {ayah}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <SurahSearchModal
        open={searchOpen}
        chapters={chapters}
        onClose={() => setSearchOpen(false)}
        onSelectSurah={handleSurahPick}
      />
    </HomeScreen>
  )
}
