'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Mic, Search } from 'lucide-react'
import HomeScreen from '@/components/home/HomeScreen'
import SurahSearchModal from '@/components/read/SurahSearchModal'
import { useAppSettings } from '@/hooks/useAppSettings'
import { setAppSettings } from '@/lib/app-settings'
import { RECITERS, isSurahOnlyReciter } from '@/lib/reciters'
import { getChapters, getVersesByChapter } from '@/lib/quran'
import { getRecentPractice } from '@/lib/imitate-progress'
import type { PracticeRecord } from '@/lib/imitate-progress'
import type { Chapter } from '@/types'
import { cn } from '@/lib/cn'

const QUICK_SURAHS = [
  { id: 1, label: 'Al-Fatiha', subtitle: '7 ayahs · great to start' },
  { id: 112, label: 'Al-Ikhlas', subtitle: '4 ayahs' },
  { id: 114, label: 'An-Nas', subtitle: '6 ayahs' },
  { id: 36, label: 'Ya-Sin', subtitle: '83 ayahs' },
] as const

export default function ImitateScreen() {
  const settings = useAppSettings()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loadingChapters, setLoadingChapters] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [pickedSurah, setPickedSurah] = useState<number | null>(null)
  const [ayahCount, setAyahCount] = useState(0)
  const [loadingAyahs, setLoadingAyahs] = useState(false)
  const [recent, setRecent] = useState<PracticeRecord[]>([])

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

  return (
    <HomeScreen className="max-w-lg mx-auto">
      <header className="mb-6 flex items-center gap-3">
        <Link
          href="/"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--home-sage-deep)] hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Back home"
        >
          <ChevronLeft className="h-7 w-7" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--home-sage-soft)]">
            <Mic className="h-5 w-5 text-[var(--home-sage-deep)]" />
          </span>
          <div>
            <h1 className="home-serif text-xl font-semibold text-[var(--home-heading)]">Imitate</h1>
            <p className="text-xs text-[var(--home-muted)]">Match the reciter&apos;s voice</p>
          </div>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
          Reciter
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {imitateReciters.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setAppSettings({ reciterId: r.id })}
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-2 text-xs font-medium transition-colors',
                r.id === settings.reciterId
                  ? 'border-[var(--home-sage)] bg-[var(--home-sage-soft)] text-[var(--home-sage-deep)]'
                  : 'border-[var(--home-card-border)] bg-[var(--app-surface)] text-[var(--app-muted)]'
              )}
            >
              {r.name.split(' ').slice(-1)[0]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-[var(--home-muted)]">
          Practicing with <span className="font-medium text-[var(--home-heading)]">{currentReciter.name}</span>
        </p>
      </section>

      {!pickedSurah ? (
        <>
          <section className="mb-6">
            <h2 className="home-serif mb-3 text-lg font-semibold text-[var(--home-heading)]">Quick start</h2>
            <ul className="space-y-2">
              {QUICK_SURAHS.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setPickedSurah(s.id)}
                    className="flex w-full items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-4 text-left shadow-[var(--home-card-shadow)] transition-transform active:scale-[0.99]"
                  >
                    <div>
                      <p className="font-medium text-[var(--home-heading)]">{s.label}</p>
                      <p className="text-xs text-[var(--home-muted)]">{s.subtitle}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--home-muted)]" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            disabled={loadingChapters}
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-4 text-sm font-medium text-[var(--home-sage-deep)]"
          >
            <Search className="h-4 w-4" />
            Search all 114 surahs
          </button>

          {recent.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--home-muted)]">
                Continue practicing
              </h2>
              <ul className="space-y-2">
                {recent.map((r) => (
                  <li key={`${r.reciterId}-${r.surah}-${r.ayah}-${r.practicedAt}`}>
                    <Link
                      href={`/imitate/${r.surah}/${r.ayah}`}
                      className="flex items-center justify-between rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] px-4 py-3 text-sm shadow-[var(--home-card-shadow)]"
                    >
                      <span className="text-[var(--home-heading)]">
                        Surah {r.surah} · Ayah {r.ayah}
                      </span>
                      <span className="font-semibold text-[var(--home-sage-deep)]">{r.voiceSimilarity}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-[var(--home-card-border)] bg-[var(--home-card-bg)] p-4 shadow-[var(--home-card-shadow)]">
          <button
            type="button"
            onClick={() => setPickedSurah(null)}
            className="mb-3 text-sm font-medium text-[var(--home-sage-deep)]"
          >
            ← Back
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
                    className="flex h-11 items-center justify-center rounded-xl border border-[var(--home-card-border)] bg-[var(--app-surface)] text-sm font-semibold text-[var(--home-heading)] transition-colors hover:bg-[var(--home-sage-soft)] active:scale-95"
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
