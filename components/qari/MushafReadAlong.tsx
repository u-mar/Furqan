'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import QuranPageView from '@/components/QuranPageView'
import SurahSearchModal from '@/components/read/SurahSearchModal'
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
}

/**
 * A read-only mushaf a reciter can open mid-recording to read from, on
 * whatever page they navigate to — the audio recording (owned by the Qari
 * record page, not this component) keeps running underneath since this is
 * just an overlay, not a route change.
 */
export default function MushafReadAlong({ open, onClose, initialPage = 1 }: MushafReadAlongProps) {
  const t = useT()
  const [page, setPage] = useState(initialPage)
  const [verses, setVerses] = useState<Verse[] | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterNamesById, setChapterNamesById] = useState<Record<number, string>>({})
  const [searchOpen, setSearchOpen] = useState(false)

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
    void getMushafPage(page).then((v) => {
      if (!cancelled) setVerses(v)
    })
    return () => {
      cancelled = true
    }
  }, [open, page])

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
        <span className="text-[0.8125rem] font-semibold text-[var(--home-muted)]">{t('Page {page}', { page })}</span>
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
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
