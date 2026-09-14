'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Play, Share2, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getDailyVerseConfig } from '@/lib/admin'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmarks'
import AyahEndMark from '@/components/read/AyahEndMark'
import { getVerseArabicText, stripAyahRefFromLabel } from '@/lib/quran-display'
import { useQcfFont } from '@/hooks/useQcfFont'
import {
  getVerseQcfGlyphWords,
  pageHasQcfData,
  qcfPageFontFamily,
  qcfPageSampleGlyphs,
  versePageNumber,
} from '@/lib/qcf-page'
import { getVerseByKey, everyAyahUrl } from '@/lib/quran'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Verse } from '@/types'

const DEFAULT_DAILY_VERSE_KEY = '2:152'
const DEFAULT_SURAH = 'Al-Baqarah'

const FALLBACK_TRANSLATION =
  'So remember Me; I will remember you. And be grateful to Me and do not deny Me.'

/* Inline, because .ed-arabic sets its own size and would win over a utility. */
const ARABIC_SIZE = { fontSize: '1.5625rem', lineHeight: 1.95 } as const

/**
 * The one verse this card needs.
 *
 * Asked of the server first: that is about a kilobyte. The alternative,
 * getVerseByKey, reads the whole 16MB Quran file and parses it on the main
 * thread — on a first open that was the slowest thing on the home screen, all
 * to show a single ayah. It remains the fallback for when there is no
 * connection, since it can read the copy saved for offline use.
 */
async function loadDailyVerse(verseKey: string): Promise<Verse> {
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch(`/api/ayah?type=verse&verseKey=${encodeURIComponent(verseKey)}`)
      if (res.ok) return (await res.json()) as Verse
    } catch {
      // Fall through to the local copy.
    }
  }
  return getVerseByKey(verseKey)
}

export default function DailyVerseCard() {
  const { translationLanguage, translationEditionId } = useAppSettings()
  const [arabic, setArabic] = useState('')
  const [translation, setTranslation] = useState(FALLBACK_TRANSLATION)
  const [page, setPage] = useState(22)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [dailyVerseKey, setDailyVerseKey] = useState(DEFAULT_DAILY_VERSE_KEY)
  const [dailyVerse, setDailyVerse] = useState<Verse | null>(null)
  const [dailySurahLabel, setDailySurahLabel] = useState(DEFAULT_SURAH)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  /* The verse is set in the same mushaf glyphs the reader uses, rather than a
     substitute Arabic face, so the two screens agree. Falls back to the plain
     text whenever the page's glyph font cannot be had. */
  const qcfPage = dailyVerse ? versePageNumber(dailyVerse) : 0
  const hasQcf = Boolean(dailyVerse) && qcfPage > 0 && pageHasQcfData(dailyVerse ? [dailyVerse] : [])
  const qcfWords = useMemo(
    () => (hasQcf && dailyVerse ? getVerseQcfGlyphWords(dailyVerse, qcfPage) : []),
    [hasQcf, dailyVerse, qcfPage]
  )
  const qcfSample = useMemo(
    () => (hasQcf && dailyVerse ? qcfPageSampleGlyphs([dailyVerse], qcfPage) : ''),
    [hasQcf, dailyVerse, qcfPage]
  )
  const { ready: qcfReady } = useQcfFont(qcfPage, hasQcf && qcfWords.length > 0, qcfSample)
  const useGlyphs = hasQcf && qcfReady && qcfWords.length > 0

  useEffect(() => {
    const applyConfig = async () => {
      const config = await getDailyVerseConfig()
      setDailyVerseKey(config.verseKey || DEFAULT_DAILY_VERSE_KEY)
      setDailySurahLabel(config.surahName || DEFAULT_SURAH)
      setSaved(isBookmarked(config.verseKey || DEFAULT_DAILY_VERSE_KEY))
    }
    void applyConfig()
    const onChanged = () => void applyConfig()
    window.addEventListener('admin-store-changed', onChanged)
    return () => window.removeEventListener('admin-store-changed', onChanged)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const verse = await loadDailyVerse(dailyVerseKey)
        if (cancelled) return
        setDailyVerse(verse)
        setArabic(getVerseArabicText(verse, { omitEndMark: true }))
        setPage(verse.page_number || 22)

        const res = await fetch(
          `/api/ayah?type=translations&page=${verse.page_number || 22}&lang=${translationLanguage}&edition=${translationEditionId}`
        )
        if (res.ok) {
          const rows = (await res.json()) as Array<{
            verse_key: string
            translation: string
          }>
          const row = rows.find((r) => r.verse_key === dailyVerseKey)
          if (row?.translation && !cancelled) setTranslation(row.translation)
        }
      } catch {
        /* keep fallbacks */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dailyVerseKey, translationLanguage, translationEditionId])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const toggleSave = () => {
    if (saved) {
      removeBookmark(dailyVerseKey)
      setSaved(false)
      return
    }
    addBookmark({
      verseKey: dailyVerseKey,
      surahName: dailySurahLabel,
      ayah: Number(dailyVerseKey.split(':')[1] || 1),
      page,
      arabic: arabic || FALLBACK_TRANSLATION,
      createdAt: Date.now(),
    })
    setSaved(true)
  }

  const handleShare = async () => {
    const text = `${surahBadge}\n\n${arabic}\n\n${translation}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Daily Verse', text })
      } catch {
        /* user cancelled */
      }
      return
    }
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  const [surahNum, ayahNum] = dailyVerseKey.split(':')
  const surahBadge = stripAyahRefFromLabel(dailySurahLabel)
  const endWord = dailyVerse?.words?.find((word) => word.char_type_name === 'end')
  const endMarkPage = endWord?.v2_page || endWord?.page_number || page

  const handlePlayToggle = () => {
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }

    if (!audioRef.current) {
      const audio = new Audio(everyAyahUrl(Number(surahNum), Number(ayahNum)))
      audio.addEventListener('ended', () => setPlaying(false))
      audio.addEventListener('pause', () => setPlaying(false))
      audioRef.current = audio
    }

    void audioRef.current.play()
    setPlaying(true)
  }

  return (
    <section aria-label="Weekly verse">
      <div className="mb-[9px] flex items-center justify-between gap-3">
        <h2 className="home-label">Weekly verse</h2>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="ed-focus -my-2 flex items-center gap-[5px] rounded-md py-2 text-[0.78125rem] font-semibold text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
          Share
        </button>
      </div>

      <div className="home-card rounded-[18px] px-[18px] pb-3.5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-[var(--home-sage-soft)] px-[11px] text-xs font-semibold text-[var(--home-sage-deep)]">
            <span className="truncate">{surahBadge}</span>
            <span className="shrink-0 font-medium opacity-80">
              {surahNum}:{ayahNum}
            </span>
          </span>
          <button
            type="button"
            onClick={toggleSave}
            className={cn(
              'ed-focus -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
              saved
                ? 'text-[var(--home-sage-deep)]'
                : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
            )}
            aria-label={saved ? 'Remove bookmark' : 'Bookmark verse'}
            aria-pressed={saved}
          >
            <Bookmark className={cn('h-[18px] w-[18px]', saved && 'fill-current')} strokeWidth={1.8} />
          </button>
        </div>

        {useGlyphs ? (
          // The glyph run already carries its own ayah marker, so no end mark
          // is appended here.
          <p
            className="ed-arabic mt-2.5 text-[var(--home-heading)]"
            dir="rtl"
            lang="ar"
            style={{ fontFamily: qcfPageFontFamily(qcfPage), ...ARABIC_SIZE }}
          >
            {qcfWords.map((word, i) => (
              <span key={i} className="mushaf-translation-qcf-word">
                {word}
              </span>
            ))}
          </p>
        ) : (
          <p className="ed-arabic mt-2.5 text-[var(--home-heading)]" dir="rtl" lang="ar" style={ARABIC_SIZE}>
            {loading ? (
              '…'
            ) : (
              <>
                {arabic || '…'}
                {dailyVerse ? (
                  <>
                    {' '}
                    <AyahEndMark
                      verseKey={dailyVerseKey}
                      pageNumber={endMarkPage}
                      codeV2={endWord?.code_v2}
                      fallbackText={endWord?.text_uthmani || endWord?.text_qpc_hafs || ''}
                      className="text-[var(--home-sage)]"
                    />
                  </>
                ) : null}
              </>
            )}
          </p>
        )}

        <p className="home-serif mx-auto mt-2 max-w-[300px] text-center text-[1.03125rem] leading-[1.5] text-[var(--home-heading)] [text-wrap:pretty]">
          {loading ? 'Loading translation…' : translation}
        </p>

        <div className="ed-rule mb-3 mt-3.5" />

        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.78125rem] text-[var(--home-muted)]">
            Page <span className="font-semibold text-[var(--home-heading)]">{page}</span> of the mushaf
          </span>
          <button
            type="button"
            onClick={handlePlayToggle}
            className="ed-ink ed-focus flex h-9 shrink-0 items-center gap-[7px] rounded-full pl-3 pr-[15px] text-[0.84375rem] font-semibold transition-transform active:scale-95"
            aria-label={playing ? 'Stop recitation' : 'Play recitation'}
          >
            {playing ? (
              <Square className="h-3 w-3 fill-current" />
            ) : (
              <Play className="h-[13px] w-[13px] fill-current" />
            )}
            {playing ? 'Stop' : 'Listen'}
          </button>
        </div>
      </div>
    </section>
  )
}
