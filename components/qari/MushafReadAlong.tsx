'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Mic, Search, Square, X } from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import SurahSearchModal from '@/components/read/SurahSearchModal'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { TOTAL_MUSHAF_PAGES } from '@/lib/mushaf'
import { getChapters, getMushafPage, getVisualPageForVerse } from '@/lib/quran'
import { useT } from '@/lib/i18n'
import type { Chapter, Verse } from '@/types'

interface MushafReadAlongProps {
  open: boolean
  onClose: () => void
  /** Where to open, e.g. resuming on the page last left on. Defaults to 1. */
  initialPage?: number
  /** Lets the reciter start/stop recording without leaving the mushaf. */
  recording: boolean
  countingDown: boolean
  count: number
  elapsedLabel: string
  onBegin: () => void
  onStop: () => void
}

/**
 * A read-only mushaf a reciter can open mid-recording to read from, on
 * whatever page they navigate to — the audio recording (owned by the Qari
 * record page, not this component) keeps running underneath since this is
 * just an overlay, not a route change. Carries its own record/stop button
 * (mirroring the main screen's) so a reciter never has to close it just to
 * start or finish.
 */
export default function MushafReadAlong({
  open,
  onClose,
  initialPage = 1,
  recording,
  countingDown,
  count,
  elapsedLabel,
  onBegin,
  onStop,
}: MushafReadAlongProps) {
  const t = useT()
  const [page, setPage] = useState(initialPage)
  const [verses, setVerses] = useState<Verse[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterNamesById, setChapterNamesById] = useState<Record<number, string>>({})
  const [searchOpen, setSearchOpen] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!open) return
    void getChapters().then((cs) => {
      setChapters(cs)
      setChapterNamesById(Object.fromEntries(cs.map((c) => [c.id, c.englishName || c.name])))
    })
  }, [open])

  useEffect(() => {
    if (open) setPage(initialPage)
    // Only reset when the overlay opens, not on every initialPage change —
    // navigating inside it shouldn't get stomped by the caller's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadError(null)
    getMushafPage(page)
      .then((v) => {
        if (!cancelled) setVerses(v)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setVerses(null)
        setLoadError(err instanceof Error ? err.message : t('Could not load this page.'))
      })
    return () => {
      cancelled = true
    }
  }, [open, page, retryKey, t])

  if (!open) return null

  const keys = new Set((verses ?? []).map((v) => v.verse_key))

  const goToVerse = async (verseKey: string) => {
    const targetPage = await getVisualPageForVerse(verseKey, page)
    setPage(targetPage)
    setSearchOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--app-bg)] text-[var(--app-text)]">
      <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            onClose()
          }}
          aria-label={t('Close')}
          className="home-round ed-focus"
        >
          <X className="h-5 w-5" strokeWidth={1.9} />
        </button>
        {recording ? (
          <span className="flex h-[30px] items-center gap-2 rounded-full bg-rose-500/[0.12] px-3 text-[12.5px] font-bold text-rose-600 dark:text-rose-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            {elapsedLabel}
          </span>
        ) : (
          <span className="text-[0.8125rem] font-semibold text-[var(--home-muted)]">{t('Page {page}', { page })}</span>
        )}
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            setSearchOpen(true)
          }}
          aria-label={t('Search surah')}
          className="home-round ed-focus"
        >
          <Search className="h-5 w-5" strokeWidth={1.9} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden px-1">
        {verses ? (
          <QuranPageView
            key={page}
            verses={verses}
            chapterNamesById={chapterNamesById}
            startVerseKey={verses[0]?.verse_key || ''}
            revealableVerseKeys={keys}
            revealedAyahs={keys}
            onReveal={() => {}}
            readOnly
            readMode
            pageNumber={page}
          />
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-[var(--home-muted)]">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setRetryKey((k) => k + 1)
              }}
              className="ed-focus fx-press rounded-full border border-[var(--home-rule-strong)] px-4 py-2 text-[13px] font-semibold text-[var(--home-heading)]"
            >
              {t('Retry')}
            </button>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex w-full items-center justify-center gap-7">
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              setPage((p) => Math.max(1, p - 1))
            }}
            disabled={page <= 1}
            aria-label={t('Previous page')}
            className="hifdh-hint ed-focus disabled:opacity-30"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>

          {countingDown ? (
            <span className="flex h-[4.25rem] w-[4.25rem] items-center justify-center">
              <span key={count} className="qari-count home-serif text-[2.25rem] font-medium text-[var(--home-heading)]">
                {count}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (recording) onStop()
                else onBegin()
              }}
              aria-label={recording ? t('Finish recording') : t('Start recording')}
              className={cn('hifdh-rec ed-focus', recording && 'hifdh-rec--listening')}
            >
              {recording ? (
                <Square className="h-4 w-4" fill="currentColor" strokeWidth={0} />
              ) : (
                <Mic className="h-7 w-7" strokeWidth={2.2} />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              tapFeedback()
              setPage((p) => Math.min(TOTAL_MUSHAF_PAGES, p + 1))
            }}
            disabled={page >= TOTAL_MUSHAF_PAGES}
            aria-label={t('Next page')}
            className="hifdh-hint ed-focus disabled:opacity-30"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <SurahSearchModal
        open={searchOpen}
        chapters={chapters}
        onClose={() => setSearchOpen(false)}
        onSelectSurah={(chapterId) => void goToVerse(`${chapterId}:1`)}
        onSelectAyah={(verseKey) => void goToVerse(verseKey)}
      />
    </div>
  )
}
