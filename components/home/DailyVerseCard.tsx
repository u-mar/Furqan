'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, Play, Share2, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getDailyVerseConfig } from '@/lib/admin'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmarks'
import AyahEndMark from '@/components/read/AyahEndMark'
import { IconOrnament } from '@/components/home/TileIcons'
import { getVerseArabicText, stripAyahRefFromLabel } from '@/lib/quran-display'
import { getVerseByKey, everyAyahUrl } from '@/lib/quran'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Verse } from '@/types'

const DEFAULT_DAILY_VERSE_KEY = '2:152'
const DEFAULT_SURAH = 'Al-Baqarah'

const FALLBACK_TRANSLATION =
  'So remember Me; I will remember you. And be grateful to Me and do not deny Me.'

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
        const verse = await getVerseByKey(dailyVerseKey)
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
    <section className="mb-9" aria-label="Daily verse">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="ed-label">Weekly verse</h2>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="ed-focus flex items-center gap-1.5 rounded-md text-xs font-semibold text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          Share
        </button>
      </div>

      <div
        className="ed-card ed-frame relative overflow-hidden rounded-[1.25rem] px-5 pb-5 pt-5 sm:px-7"
        style={{ ['--ed-radius' as string]: '1.25rem' }}
      >
        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--home-rule-strong)] py-1 pl-3 pr-2.5 text-[0.7rem] font-semibold tracking-[0.08em] text-[var(--home-heading)]">
            {surahBadge}
            <span className="ed-num text-[0.78rem] font-normal text-[var(--home-muted)]">
              {surahNum}:{ayahNum}
            </span>
          </span>
          <button
            type="button"
            onClick={toggleSave}
            className={cn(
              'ed-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
              saved
                ? 'text-[var(--home-sage-deep)]'
                : 'text-[var(--home-muted)] hover:text-[var(--home-heading)]'
            )}
            aria-label={saved ? 'Remove bookmark' : 'Bookmark verse'}
            aria-pressed={saved}
          >
            <Bookmark className={cn('h-[18px] w-[18px]', saved && 'fill-current')} strokeWidth={1.75} />
          </button>
        </div>

        <p className="ed-arabic relative mt-6 text-[var(--home-heading)]" dir="rtl" lang="ar">
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
                    className="text-[var(--home-sage-deep)]"
                  />
                </>
              ) : null}
            </>
          )}
        </p>

        <div className="relative my-5 flex items-center justify-center gap-3">
          <span className="ed-rule w-10" />
          <IconOrnament className="h-2.5 w-2.5 text-[var(--home-sage)]" />
          <span className="ed-rule w-10" />
        </div>

        <p className="home-serif relative mx-auto max-w-[36ch] text-center text-[1.02rem] leading-[1.7] text-[var(--home-heading)]">
          {loading ? 'Loading translation…' : translation}
        </p>

        <div className="relative mt-6 flex items-center justify-between gap-3 border-t border-[var(--home-rule)] pt-4">
          <span className="text-xs text-[var(--home-muted)]">
            Page <span className="ed-num text-[var(--home-heading)]">{page}</span> of the mushaf
          </span>
          <button
            type="button"
            onClick={handlePlayToggle}
            className="ed-ink ed-focus flex h-10 items-center gap-2 rounded-full pl-3.5 pr-4 text-[0.8rem] font-semibold transition-transform hover:scale-[1.03] active:scale-95"
            aria-label={playing ? 'Stop recitation' : 'Play recitation'}
          >
            {playing ? (
              <Square className="h-3.5 w-3.5 fill-current" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
            {playing ? 'Stop' : 'Listen'}
          </button>
        </div>
      </div>
    </section>
  )
}
