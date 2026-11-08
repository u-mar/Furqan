'use client'

import Link from 'next/link'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Bookmark, Check, Pause, Play, Share } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fetchDailyVerseConfig, getLocalDailyVerseConfig } from '@/lib/admin'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmarks'
import { getVerseArabicText, stripAyahRefFromLabel } from '@/lib/quran-display'
import { getVerseByKey, everyAyahUrl } from '@/lib/quran'
import {
  readWeeklyVerseCache as readCache,
  writeWeeklyVerseCache as writeCache,
} from '@/lib/weekly-verse-cache'
import { useAppSettings } from '@/hooks/useAppSettings'
import type { Verse } from '@/types'
import { tr, useT } from '@/lib/i18n'

interface WeeklyConfig {
  verseKey: string
  surahName: string
  /** The server said so during this visit, rather than a copy standing in for it. */
  confirmed: boolean
}

/**
 * How long the server gets to say which verse it is before the copy on the
 * phone is shown instead. Long enough that a normal connection answers first
 * (so nothing is swapped in front of the reader), short enough that a slow one
 * does not leave the card empty.
 */
const SERVER_BUDGET_MS = 800

/** A copy confirmed longer ago than this may be last week's: wait for the server. */
const CACHE_TRUST_MS = 24 * 60 * 60 * 1000

/** How long to hold the ayah back for its font before showing it in another. */
const FONT_WAIT_MS = 1500

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

/** The ayah's largest size, and the smallest it may shrink to before it wraps onto a second line instead. */
const AYAH_MAX_PX = 21
const AYAH_MIN_PX = 15

/**
 * Sizes the ayah to sit on one line across the phone's width: as large as
 * AYAH_MAX_PX, smaller for a longer ayah. One so long that it would have to go
 * below AYAH_MIN_PX wraps at that size instead. Refits when the width changes.
 */
function useOneLineAyah(ref: RefObject<HTMLElement | null>, key: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.whiteSpace = 'nowrap'
      el.style.fontSize = `${AYAH_MAX_PX}px`
      const natural = el.scrollWidth
      const room = el.clientWidth
      if (!natural || !room) return
      const size = Math.min(AYAH_MAX_PX, Math.floor(((AYAH_MAX_PX * room) / natural) * 0.98 * 10) / 10)
      if (size >= AYAH_MIN_PX) {
        el.style.fontSize = `${size}px`
      } else {
        el.style.fontSize = `${AYAH_MIN_PX}px`
        el.style.whiteSpace = ''
      }
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, key])
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Not available over plain http; the old way still works there.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export default function DailyVerseCard() {
  const t = useT()
  const { translationLanguage, translationEditionId } = useAppSettings()
  const [config, setConfig] = useState<WeeklyConfig | null>(null)
  const [verse, setVerse] = useState<Verse | null>(null)
  const [verseFailed, setVerseFailed] = useState(false)
  /** null while loading, '' when there is none to show. */
  const [translation, setTranslation] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [fontWaitOver, setFontWaitOver] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const ayahRef = useRef<HTMLParagraphElement>(null)

  const verseKey = config?.verseKey ?? null

  /* Which verse. The server decides: the card used to start from a built-in
     default and show it until the server answered, which is how last week's
     verse flashed up before this week's. The copy on the phone stands in only
     when the server is slow or unreachable, and only if it is recent. */
  useEffect(() => {
    let cancelled = false
    let inFlight = false

    const adopt = (next: Pick<WeeklyConfig, 'verseKey' | 'surahName'>, confirmed: boolean) => {
      setConfig((prev) =>
        prev && prev.verseKey === next.verseKey && prev.surahName === next.surahName
          ? prev
          : { verseKey: next.verseKey, surahName: next.surahName, confirmed }
      )
    }

    const sync = async () => {
      if (inFlight) return
      inFlight = true
      const cached = readCache()
      const recent = cached && Date.now() - cached.confirmedAt < CACHE_TRUST_MS ? cached : null
      const standIn = recent
        ? window.setTimeout(() => {
            // Only fills an empty card; it never replaces a verse already shown.
            if (!cancelled) setConfig((prev) => prev ?? { verseKey: recent.verseKey, surahName: recent.surahName, confirmed: false })
          }, SERVER_BUDGET_MS)
        : undefined

      const fresh = await fetchDailyVerseConfig()
      window.clearTimeout(standIn)
      inFlight = false
      if (cancelled) return

      if (fresh) {
        if (cached?.verseKey === fresh.verseKey) {
          writeCache({ ...cached, surahName: fresh.surahName, confirmedAt: Date.now() })
        }
        adopt(fresh, true)
      } else {
        adopt(cached ?? getLocalDailyVerseConfig(), false)
      }
    }

    void sync()
    const onChanged = () => void sync()
    window.addEventListener('admin-store-changed', onChanged)
    return () => {
      cancelled = true
      window.removeEventListener('admin-store-changed', onChanged)
    }
  }, [])

  /* The verse itself — from the phone's copy when it is the same one. */
  useEffect(() => {
    if (!config) return
    const { verseKey: key, surahName, confirmed } = config
    setSaved(isBookmarked(key))

    const cached = readCache()
    if (cached?.verseKey === key) {
      if (cached.surahName !== surahName) writeCache({ ...cached, surahName })
      setVerse(cached.verse)
      setVerseFailed(false)
      return
    }

    let cancelled = false
    setVerse(null)
    setVerseFailed(false)
    loadDailyVerse(key)
      .then((loaded) => {
        if (cancelled) return
        setVerse(loaded)
        writeCache({
          verseKey: key,
          surahName,
          verse: loaded,
          translations: {},
          confirmedAt: confirmed ? Date.now() : 0,
        })
      })
      .catch(() => {
        if (!cancelled) setVerseFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [config])

  /* Its translation, in the language chosen in Settings. */
  useEffect(() => {
    if (!verse) return
    const key = verse.verse_key
    const cached = readCache()
    const known = cached?.verseKey === key ? cached.translations?.[translationEditionId] : undefined
    if (known) {
      setTranslation(known)
      return
    }

    let cancelled = false
    setTranslation(null)
    fetch(
      `/api/ayah?type=translations&page=${verse.page_number || 1}&lang=${translationLanguage}&edition=${translationEditionId}`
    )
      .then((res) => (res.ok ? (res.json() as Promise<Array<{ verse_key: string; translation: string }>>) : []))
      .then((rows) => {
        if (cancelled) return
        const text = rows.find((row) => row.verse_key === key)?.translation?.trim() ?? ''
        setTranslation(text)
        const latest = readCache()
        if (text && latest?.verseKey === key) {
          writeCache({ ...latest, translations: { ...latest.translations, [translationEditionId]: text } })
        }
      })
      .catch(() => {
        if (!cancelled) setTranslation('')
      })
    return () => {
      cancelled = true
    }
  }, [verse, translationLanguage, translationEditionId])

  /* The ayah is set in the King Fahd Uthmanic font: the Madani script at an ordinary
     weight, where the reader's page fonts are too heavy for one small line. It waits
     a moment for that font rather than flashing another first. */
  useEffect(() => {
    let cancelled = false
    const done = () => {
      if (!cancelled) setFontWaitOver(true)
    }
    const timer = window.setTimeout(done, FONT_WAIT_MS)
    void document.fonts.load(`${AYAH_MAX_PX}px 'UthmanicHafs'`, 'ق').then(done, done)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  /* A different verse needs its own recitation. */
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
      setPlaying(false)
    }
  }, [verseKey])

  const arabicText = verse ? getVerseArabicText(verse, { omitEndMark: true }) : ''
  const surahLabel = config ? stripAyahRefFromLabel(config.surahName) : ''
  const page = verse?.page_number || 1

  const toggleSave = () => {
    if (!config) return
    if (saved) {
      removeBookmark(config.verseKey)
      setSaved(false)
      return
    }
    addBookmark({
      verseKey: config.verseKey,
      surahName: surahLabel,
      ayah: Number(config.verseKey.split(':')[1] || 1),
      page,
      arabic: arabicText,
      createdAt: Date.now(),
    })
    setSaved(true)
  }

  const handleShare = async () => {
    if (!config) return
    const text = [`${surahLabel} ${config.verseKey}`, arabicText, translation].filter(Boolean).join('\n\n')
    if (navigator.share) {
      try {
        await navigator.share({ title: tr('Weekly verse'), text })
      } catch {
        // Cancelled.
      }
      return
    }
    if (await copyToClipboard(text)) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    }
  }

  const togglePlay = () => {
    if (!config) return
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    if (!audioRef.current) {
      const [surah, ayah] = config.verseKey.split(':').map(Number)
      const audio = new Audio(everyAyahUrl(surah, ayah))
      audio.addEventListener('ended', () => setPlaying(false))
      audio.addEventListener('pause', () => setPlaying(false))
      audioRef.current = audio
    }
    void audioRef.current.play().catch(() => setPlaying(false))
    setPlaying(true)
  }

  const endWord = verse?.words?.find((word) => word.char_type_name === 'end')
  // The font is part of being ready, so the card appears once, whole.
  const ready = config !== null && verse !== null && fontWaitOver
  useOneLineAyah(ayahRef, `${ready}:${verseKey}`)

  // Each word as the King Fahd font expects it. That font draws the circle around
  // the ayah's number itself, and the number stays with the last word.
  const ayahText =
    (verse?.words ?? [])
      .filter((word) => word.char_type_name !== 'end')
      .map((word) => (word.text_qpc_hafs || word.text_uthmani || '').trim())
      .filter(Boolean)
      .join(' ') || arabicText
  const lastSpace = ayahText.lastIndexOf(' ')

  // No card, like the prayer times: a small spaced line with the surah and verse,
  // the ayah in the Madani script, its meaning in grey,
  // then Listen with round bookmark and share buttons under a thin line.
  return (
    <section aria-label={t('Ayah of the week')} aria-busy={!ready} className="px-1">
      {!ready ? (
        verseFailed ? (
          <>
            <p className="home-date">{t('Ayah of the week')}</p>
            <p className="mt-3 text-[0.875rem] text-[var(--home-muted)]">{t("This week's verse will show when you're back online.")}</p>
          </>
        ) : (
          <VerseSkeleton />
        )
      ) : (
        <div className="home-fade">
          <Link href={`/read?page=${page}`} className="ed-focus block rounded-lg">
            {/* "Surah" left off, so the line fits a narrow phone; it may wrap rather than be cut. */}
            <span className="home-date block">
              {t('Ayah of the week')} · {surahLabel.replace(/^surah\s+/i, '')} {config.verseKey}
            </span>
          </Link>

          {/* Up to three lines of each; the whole verse opens in the reader. */}
          <Link href={`/read?page=${page}`} className="ed-focus mt-2 block rounded-lg" aria-label={t('Page {page}', { page })}>
            <p ref={ayahRef} className="home-ayah home-ayah--week home-ayah--plain home-fade" dir="rtl" lang="ar">
              {ayahText.slice(0, lastSpace + 1)}
              <span className="weekly-verse__keep">
                {ayahText.slice(lastSpace + 1)} {endWord?.text_qpc_hafs || endWord?.text_uthmani || ''}
              </span>
            </p>

            {translation === null ? (
              <TranslationSkeleton />
            ) : translation ? (
              <p dir="auto" className="home-ayah-translation home-ayah-translation--week home-fade mt-1.5">
                {translation}
              </p>
            ) : null}
          </Link>

          <div className="mt-4 flex items-center gap-2 border-t border-[var(--home-rule)] pt-3.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-pressed={playing}
              className="fx-press ed-focus inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[0.9375rem] font-semibold text-black"
            >
              {playing ? (
                <Pause className="h-[15px] w-[15px] fill-current" strokeWidth={0} />
              ) : (
                <Play className="h-[15px] w-[15px] fill-current" strokeWidth={0} />
              )}
              {playing ? t('Pause') : t('Listen')}
            </button>
            <IconButton label={saved ? t('Remove bookmark') : t('Bookmark verse')} pressed={saved} onClick={toggleSave}>
              <Bookmark className={cn('h-[18px] w-[18px]', saved && 'fill-current')} strokeWidth={1.8} />
            </IconButton>
            <IconButton label={copied ? t('Copied') : t('Share verse')} onClick={() => void handleShare()}>
              {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2.4} /> : <Share className="h-[18px] w-[18px]" strokeWidth={1.8} />}
            </IconButton>
          </div>
        </div>
      )}
    </section>
  )
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="ed-focus flex h-[2.625rem] w-[2.625rem] items-center justify-center rounded-full bg-[var(--home-card-bg)] text-white transition-transform active:scale-90"
    >
      {children}
    </button>
  )
}

function ArabicSkeleton() {
  return (
    <div className="flex flex-col items-end gap-3 py-3" aria-hidden>
      <span className="block h-5 w-4/5 animate-pulse rounded-full bg-[var(--home-card-bg)]" />
    </div>
  )
}

function TranslationSkeleton() {
  return (
    <div className="mt-1.5 flex flex-col gap-2 py-1" aria-hidden>
      <span className="block h-2.5 w-3/4 animate-pulse rounded-full bg-[var(--home-card-bg)]" />
      <span className="block h-2.5 w-1/2 animate-pulse rounded-full bg-[var(--home-card-bg)]" />
    </div>
  )
}

/** Roughly the finished section's shape, so nothing jumps when it fills in. */
function VerseSkeleton() {
  return (
    <div aria-hidden>
      <span className="block h-3 w-48 animate-pulse rounded-full bg-[var(--home-card-bg)]" />
      <ArabicSkeleton />
      <TranslationSkeleton />
      <div className="mt-4 flex gap-2 border-t border-[var(--home-rule)] pt-3.5">
        <span className="block h-10 w-24 animate-pulse rounded-full bg-[var(--home-card-bg)]" />
        <span className="block h-10 w-10 animate-pulse rounded-full bg-[var(--home-card-bg)]" />
      </div>
    </div>
  )
}
