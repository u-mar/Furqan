'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bookmark, Play, Share2 } from 'lucide-react'
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

      <div className="relative overflow-hidden rounded-3xl bg-[var(--home-sage)] px-5 py-6 text-white shadow-[0_12px_40px_rgba(107,122,94,0.28)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-medium tracking-wide backdrop-blur-sm">
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

        <p className="mb-6 text-center text-sm leading-relaxed text-white/90">
          {loading ? 'Loading translation…' : translation}
        </p>

        <div className="flex items-center gap-3">
          <Link
            href={`/read?page=${page}`}
            className="flex min-h-[48px] flex-1 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[var(--home-sage-dark)] transition-transform active:scale-[0.98]"
          >
            Read Tafsir
          </Link>
          <a
            href={everyAyahUrl(Number(surahNum), Number(ayahNum))}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm transition-colors hover:bg-white/35"
            aria-label="Play recitation"
          >
            <Play className="h-5 w-5 fill-current" />
          </a>
        </div>
      </div>
    </section>
  )
}
