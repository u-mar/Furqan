'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bookmark, Check, Pause, Play, Share } from 'lucide-react'
import { cn } from '@/lib/cn'
import { fetchDailyVerseConfig, getLocalDailyVerseConfig } from '@/lib/admin'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmarks'
import AyahEndMark from '@/components/read/AyahEndMark'
import { getVerseArabicText, stripAyahRefFromLabel } from '@/lib/quran-display'
import { useQcfFont } from '@/hooks/useQcfFont'
import { loadPageFont } from '@/lib/mushaf-fonts'
import {
  getVerseQcfGlyphWords,
  pageHasQcfData,
  qcfPageFontFamily,
  qcfPageSampleGlyphs,
  versePageNumber,
} from '@/lib/qcf-page'
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

/** How long to hold the script back for the mushaf font before using the plain one. */
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
  const [fontTimedOut, setFontTimedOut] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

    // The verse rarely changes, so its mushaf font can start loading now, while
    // the server is still being asked, rather than after it answers.
    const warm = readCache()
    if (warm) {
      const warmPage = versePageNumber(warm.verse)
      if (warmPage > 0 && pageHasQcfData([warm.verse])) {
        void loadPageFont(warmPage, qcfPageSampleGlyphs([warm.verse], warmPage))
      }
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

  /* The verse is set in the same mushaf glyphs the reader uses, so the two
     screens agree. It waits a moment for that font rather than flashing a
     different script first, and falls back to plain text if it cannot load. */
  const qcfPage = verse ? versePageNumber(verse) : 0
  const hasQcf = verse !== null && qcfPage > 0 && pageHasQcfData([verse])
  const qcfWords = useMemo(
    () => (hasQcf && verse ? getVerseQcfGlyphWords(verse, qcfPage) : []),
    [hasQcf, verse, qcfPage]
  )
  const qcfSample = useMemo(
    () => (hasQcf && verse ? qcfPageSampleGlyphs([verse], qcfPage) : ''),
    [hasQcf, verse, qcfPage]
  )
  const glyphsWanted = hasQcf && qcfWords.length > 0
  const { ready: qcfReady, failed: qcfFailed } = useQcfFont(qcfPage, glyphsWanted, qcfSample)
  const useGlyphs = glyphsWanted && qcfReady
  const waitingForFont = glyphsWanted && !qcfReady && !qcfFailed && !fontTimedOut

  useEffect(() => {
    if (!glyphsWanted || qcfReady) return
    setFontTimedOut(false)
    const timer = window.setTimeout(() => setFontTimedOut(true), FONT_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [glyphsWanted, qcfReady, qcfPage])

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
  const ready = config !== null && verse !== null && !waitingForFont

  return (
    <section aria-label={t('Verse of the week')}>
      <h2 className="home-v2-label">{t('Verse of the week')}</h2>

      <article className="home-v2-card rounded-[1.625rem] px-6 pb-3.5 pt-[1.375rem]" aria-busy={!ready}>
        {!ready ? (
          verseFailed ? (
            <p className="py-8 text-center text-[0.8125rem] text-[var(--hv-text3)]">
              {t('This week\'s verse will show when you\'re back online.')}</p>
          ) : (
            <VerseSkeleton />
          )
        ) : (
          <div className="home-fade">
            <Link
              href={`/read?page=${page}`}
              className="ed-focus -mx-1 flex items-baseline justify-between gap-3 rounded-md px-1"
            >
              <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-[var(--hv-text2)]">{surahLabel}</span>
              <span className="shrink-0 text-[0.78125rem] font-medium tabular-nums text-[var(--hv-text3)]">{config.verseKey}</span>
            </Link>

            <div className="mt-4">
              {useGlyphs ? (
                // The glyph run carries its own ayah marker, so none is added.
                <p
                  className="weekly-verse__qcf home-fade text-[var(--hv-arabic)]"
                  dir="rtl"
                  lang="ar"
                  style={{ fontFamily: qcfPageFontFamily(qcfPage) }}
                >
                  {qcfWords.map((word, i) => (
                    <span key={i} className="mushaf-translation-qcf-word">
                      {word}
                    </span>
                  ))}
                </p>
              ) : (
                <p className="weekly-verse__arabic home-fade text-[var(--hv-arabic)]" dir="rtl" lang="ar">
                  {arabicText}{' '}
                  <AyahEndMark
                    verseKey={config.verseKey}
                    pageNumber={endWord?.v2_page || endWord?.page_number || page}
                    codeV2={endWord?.code_v2}
                    fallbackText={endWord?.text_uthmani || endWord?.text_qpc_hafs || ''}
                    className="text-[var(--hv-text3)]"
                  />
                </p>
              )}
            </div>

            {translation === null ? (
              <TranslationSkeleton />
            ) : translation ? (
              <p dir="auto" className="weekly-verse__translation home-fade mx-auto mt-3.5 max-w-[18.125rem] text-center">
                {translation}
              </p>
            ) : null}

            <div className="mt-[1.375rem] flex items-center justify-between gap-3 border-t border-[var(--hv-border)] pt-3">
              <button
                type="button"
                onClick={togglePlay}
                aria-pressed={playing}
                className="ed-focus flex h-11 items-center gap-2.5 rounded-full pe-3 text-[0.875rem] font-semibold text-[var(--hv-text)] transition-transform active:scale-95"
              >
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--hv-teal)] text-[var(--hv-on-teal)]">
                  {playing ? (
                    <Pause className="h-[13px] w-[13px] fill-current" strokeWidth={0} />
                  ) : (
                    <Play className="h-[13px] w-[13px] translate-x-px fill-current" strokeWidth={0} />
                  )}
                </span>
                {playing ? t('Pause') : t('Listen')}
              </button>
              <div className="-me-2.5 flex shrink-0 items-center">
                <IconButton label={saved ? t('Remove bookmark') : t('Bookmark verse')} pressed={saved} onClick={toggleSave}>
                  <Bookmark
                    className={cn('h-[19px] w-[19px]', saved && 'fill-current text-[var(--hv-teal)]')}
                    strokeWidth={1.8}
                  />
                </IconButton>
                <IconButton label={copied ? t('Copied') : t('Share verse')} onClick={() => void handleShare()}>
                  {copied ? (
                    <Check className="h-[19px] w-[19px] text-[var(--hv-teal)]" strokeWidth={2.4} />
                  ) : (
                    <Share className="h-[19px] w-[19px]" strokeWidth={1.8} />
                  )}
                </IconButton>
              </div>
            </div>
          </div>
        )}
      </article>
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
      className="ed-focus flex h-11 w-11 items-center justify-center rounded-full text-[var(--hv-text2)] transition-[color,transform] hover:text-[var(--hv-text)] active:scale-90"
    >
      {children}
    </button>
  )
}

function ArabicSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3 py-3" aria-hidden>
      <span className="qari-skeleton block h-4 w-4/5 rounded-full" />
    </div>
  )
}

function TranslationSkeleton() {
  return (
    <div className="mt-1.5 flex flex-col items-center gap-2 py-1" aria-hidden>
      <span className="qari-skeleton block h-2.5 w-3/4 rounded-full" />
      <span className="qari-skeleton block h-2.5 w-1/2 rounded-full" />
    </div>
  )
}

/** Roughly the finished card's shape, so nothing below it jumps when it fills in. */
function VerseSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex h-5 items-center">
        <span className="qari-skeleton block h-3 w-28 rounded-full" />
      </div>
      <div className="mt-4">
        <ArabicSkeleton />
      </div>
      <TranslationSkeleton />
      <div className="mt-[1.375rem] flex h-[3.5rem] items-center justify-between border-t border-[var(--hv-border)] pt-3">
        <span className="qari-skeleton block h-[34px] w-[6rem] rounded-full" />
        <span className="qari-skeleton block h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}
