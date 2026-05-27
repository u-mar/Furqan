'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark, Play, Share2, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmarks'
import { getVerseArabicText } from '@/lib/quran-display'
import { getVerseByKey, everyAyahUrl } from '@/lib/quran'
import { useAppSettings } from '@/hooks/useAppSettings'

const DAILY_VERSE_KEY = '2:152'
const DAILY_REF = 'Surah Al-Baqarah, 2:152'

const FALLBACK_TRANSLATION =
  'So remember Me; I will remember you. And be grateful to Me and do not deny Me.'

export default function DailyVerseCard() {
  const { translationLanguage } = useAppSettings()
  const [arabic, setArabic] = useState('')
  const [translation, setTranslation] = useState(FALLBACK_TRANSLATION)
  const [page, setPage] = useState(22)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setSaved(isBookmarked(DAILY_VERSE_KEY))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    void (async () => {
      try {
        const verse = await getVerseByKey(DAILY_VERSE_KEY)
        if (cancelled) return
        setArabic(getVerseArabicText(verse))
        setPage(verse.page_number || 22)

        const res = await fetch(
          `/api/ayah?type=translations&page=${verse.page_number || 22}&lang=${translationLanguage}`
        )
        if (res.ok) {
          const rows = (await res.json()) as Array<{
            verse_key: string
            translation: string
          }>
          const row = rows.find((r) => r.verse_key === DAILY_VERSE_KEY)
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
  }, [translationLanguage])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const toggleSave = () => {
    if (saved) {
      removeBookmark(DAILY_VERSE_KEY)
      setSaved(false)
      return
    }
    addBookmark({
      verseKey: DAILY_VERSE_KEY,
      surahName: 'Al-Baqarah',
      ayah: 152,
      page,
      arabic: arabic || FALLBACK_TRANSLATION,
      createdAt: Date.now(),
    })
    setSaved(true)
  }

  const handleShare = async () => {
    const text = `${DAILY_REF}\n\n${arabic}\n\n${translation}`
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

  const [surahNum, ayahNum] = DAILY_VERSE_KEY.split(':')

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
    <section className="mb-8" aria-label="Daily verse">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="home-serif text-lg font-semibold text-[var(--home-heading)]">Daily Verse</h2>
        <button
          type="button"
          onClick={() => void handleShare()}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
        >
          <Share2 className="h-4 w-4" strokeWidth={1.75} />
          Share
        </button>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl px-5 py-6 text-white shadow-[0_16px_44px_rgba(93,122,72,0.38)]"
        style={{ background: 'var(--home-sage-gradient)' }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl"
          aria-hidden
        />
        <div className="relative mb-4 flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/25 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm">
            {DAILY_REF}
          </span>
          <button
            type="button"
            onClick={toggleSave}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15"
            aria-label={saved ? 'Remove bookmark' : 'Bookmark verse'}
            aria-pressed={saved}
          >
            <Bookmark className={cn('h-5 w-5', saved && 'fill-current')} strokeWidth={1.75} />
          </button>
        </div>

        <p
          className="arabic-text mb-4 text-center text-[clamp(1.15rem,4.5vw,1.45rem)] leading-[2.1] text-white"
          dir="rtl"
          lang="ar"
        >
          {loading ? '…' : arabic || '…'}
        </p>

        <p className="relative mb-6 text-center text-sm leading-relaxed text-white">
          {loading ? 'Loading translation…' : translation}
        </p>

        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={handlePlayToggle}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#b8cf9e] text-[var(--home-sage-dark)] shadow-sm transition-colors hover:bg-[#c5d9ab]"
            aria-label={playing ? 'Stop recitation' : 'Play recitation'}
          >
            {playing ? (
              <Square className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
