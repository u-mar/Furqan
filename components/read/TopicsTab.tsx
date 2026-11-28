'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Eye,
  HeartHandshake,
  Lightbulb,
  ScrollText,
  Signpost,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Copy, Share2 } from 'lucide-react'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getOfflineTranslations } from '@/lib/offline-translations'
import { fetchPageTranslations } from '@/lib/qari-ayah'
import { getVerseByKey } from '@/lib/quran'
import { getTranslationOption, isRtlTranslationEdition } from '@/lib/translations'
import { tapFeedback } from '@/lib/haptics'
import { useLanguage, useT } from '@/lib/i18n'
import type { Chapter, Verse } from '@/types'

/**
 * Read's Topic tab: the Quran's topics from QUL (lib/quran-topics.json, built by
 * scripts/build-quran-topics.py), under Doctrine, Stories and The Unseen. A topic opens to the
 * topics under it and the ayat about it; an ayah opens its page.
 */

interface Topic {
  name: string
  ar?: string
  count: number
  ayahs?: string[]
  children?: number[]
}

interface TopicData {
  roots: number[]
  topics: Record<string, Topic>
}

let data: Promise<TopicData> | null = null
function loadTopics(): Promise<TopicData> {
  data ??= import('@/lib/quran-topics.json').then((m) => m.default as unknown as TopicData)
  return data
}

/** The topics just under Doctrine, Stories and The Unseen get a picture. */
const ICONS: Record<number, LucideIcon> = {
  1885: Sparkles, // Basic tenets
  1897: HeartHandshake, // Relationship with Allah
  2208: Users, // Relationship with people
  2284: ScrollText, // Prophets
  2361: BookOpen, // Other stories
  2380: Lightbulb, // Parables
  1837: Eye, // Unseen
  2481: Signpost, // Road to the hereafter
}

const card = 'home-card ed-focus fx-press flex min-h-[4.25rem] w-full items-center gap-3.5 rounded-[1.125rem] px-4 py-3.5 text-left'

function pageOf(verse: Verse): number {
  const first = verse.words?.[0]
  return first?.v2_page || first?.page_number || verse.page_number || 1
}

function verseText(verse: Verse): string {
  return verse.text_uthmani || (verse.words ?? []).filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani).join(' ')
}

export default function TopicsTab({
  query,
  chapters,
  onGoToPage,
}: {
  query: string
  chapters: Chapter[]
  onGoToPage: (page: number, verseKey: string) => void
}) {
  const t = useT()
  const language = useLanguage()
  const [topics, setTopics] = useState<TopicData | null>(null)
  const [path, setPath] = useState<number[]>([])
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadTopics().then(setTopics).catch(() => {})
  }, [])

  // A new search starts from the top level.
  useEffect(() => {
    if (query) setPath([])
  }, [query])

  const name = (id: number) => {
    const topic = topics?.topics[String(id)]
    if (!topic) return ''
    if (language === 'ar' && topic.ar) return topic.ar
    return t(topic.name)
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !topics) return null
    return Object.entries(topics.topics)
      .filter(([, topic]) => topic.name.toLowerCase().includes(q) || (topic.ar ?? '').includes(query.trim()))
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 60)
      .map(([id]) => Number(id))
  }, [query, topics])

  if (!topics) return <p className="px-6 py-14 text-center text-sm text-[var(--home-muted)]">{t('Loading…')}</p>

  const open = (id: number) => {
    tapFeedback()
    setPath((p) => [...p, id])
    top.current?.scrollIntoView({ block: 'start' })
  }

  const row = (id: number) => {
    const topic = topics.topics[String(id)]
    if (!topic) return null
    const Icon = ICONS[id]
    return (
      <li key={id}>
        <button type="button" onClick={() => open(id)} className={card}>
          {Icon ? <Icon className="h-[22px] w-[22px] shrink-0 text-[var(--mushaf-read-accent)]" strokeWidth={1.8} aria-hidden /> : null}
          <span className="min-w-0 flex-1 text-[1.0625rem] font-semibold leading-snug text-[var(--home-heading)]">{name(id)}</span>
          <span className="shrink-0 text-[0.9375rem] tabular-nums text-[var(--home-muted)]">{topic.count}</span>
          <ChevronRight className="-mr-1 h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
        </button>
      </li>
    )
  }

  // Search: every topic whose name matches, the ones with the most ayat first.
  if (results && !path.length) {
    return (
      <div ref={top}>
        {results.length ? (
          <ul className="space-y-2.5">{results.map(row)}</ul>
        ) : (
          <p className="px-6 py-14 text-center text-sm text-[var(--home-muted)]">{t('Nothing matches that.')}</p>
        )}
      </div>
    )
  }

  // The top level: Doctrine, Stories and The Unseen, each with the topics under it.
  if (!path.length) {
    return (
      <div ref={top}>
        {topics.roots.map((root) => (
          <section key={root} className="mb-5">
            <h3 className="home-label mx-1 mb-2.5 mt-1">{name(root)}</h3>
            <ul className="space-y-2.5">{(topics.topics[String(root)]?.children ?? []).map(row)}</ul>
          </section>
        ))}
        <p className="mx-1 mt-2 text-[0.75rem] leading-relaxed text-[var(--home-muted)]">{t('Topics from The Clear Quran, through QUL by Tarteel.')}</p>
      </div>
    )
  }

  const id = path[path.length - 1]
  const topic = topics.topics[String(id)]
  return (
    <div ref={top}>
      <button
        type="button"
        onClick={() => {
          tapFeedback()
          setPath((p) => p.slice(0, -1))
        }}
        className="ed-focus -mx-1 mb-3 flex items-center gap-2 rounded-lg px-1 py-1 text-left"
      >
        <ArrowLeft className="h-5 w-5 shrink-0 text-[var(--home-heading)]" strokeWidth={2} />
        <span className="text-[1.1875rem] font-semibold leading-snug text-[var(--home-heading)]">{name(id)}</span>
      </button>
      {topic?.children?.length ? <ul className="mb-5 space-y-2.5">{topic.children.map(row)}</ul> : null}
      {topic?.ayahs?.length ? (
        <>
          {topic.children?.length ? (
            <h3 className="home-label mx-1 mb-2.5">
              {t('Ayahs')} · {topic.ayahs.length}
            </h3>
          ) : null}
          {/* Ayat follow one another as in Read's translation mode: no cards, a line between each. */}
          <ul>
            {topic.ayahs.map((key) => (
              <AyahRow key={key} verseKey={key} chapters={chapters} onGoToPage={onGoToPage} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

/** The ayah's translation in the reader's chosen translation: from the phone when saved, else fetched. */
async function translationOf(verseKey: string, page: number, edition: string): Promise<string> {
  const saved = await getOfflineTranslations(page, edition).catch(() => null)
  const row = saved?.find((r) => r.verse_key === verseKey)
  if (row?.translation) return row.translation
  return (await fetchPageTranslations(page, edition)).get(verseKey) ?? ''
}

/**
 * One ayah about the topic, as the translation page shows it: its number and reference, copy and
 * share, the Arabic, then the translation. Its words come when the row comes into view; tapping it
 * opens its page.
 */
function AyahRow({ verseKey, chapters, onGoToPage }: { verseKey: string; chapters: Chapter[]; onGoToPage: (page: number, verseKey: string) => void }) {
  const t = useT()
  const settings = useAppSettings()
  const edition = settings.translationEditionId
  const [verse, setVerse] = useState<Verse | null>(null)
  const [translation, setTranslation] = useState<string | null>(null)
  const ref = useRef<HTMLElement>(null)
  const [surah, ayah] = verseKey.split(':').map(Number)
  const chapter = chapters.find((c) => c.id === surah)
  const option = getTranslationOption(edition)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        watcher.disconnect()
        void getVerseByKey(verseKey)
          .then(async (v) => {
            if (cancelled) return
            setVerse(v)
            const text = await translationOf(verseKey, pageOf(v), edition).catch(() => '')
            if (!cancelled) setTranslation(text)
          })
          .catch(() => {
            if (!cancelled) setTranslation('')
          })
      },
      { rootMargin: '400px 0px' }
    )
    watcher.observe(el)
    return () => {
      cancelled = true
      watcher.disconnect()
    }
  }, [verseKey, edition])

  const arabic = verse ? verseText(verse) : ''
  const shareText = `${arabic}

${translation ?? ''}

(${verseKey})`

  return (
    <li>
      <article
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={async () => {
          tapFeedback()
          const v = verse ?? (await getVerseByKey(verseKey).catch(() => null))
          onGoToPage(v ? pageOf(v) : 1, verseKey)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLElement).click()
        }}
        className="ed-focus cursor-pointer"
      >
        <div className="mushaf-translation-body px-2.5 py-6">
          <div className="mushaf-tr-meta">
            <span className="mushaf-tr-badge" aria-hidden>
              {ayah}
            </span>
            <span className="mushaf-tr-key">
              {chapter?.englishName ?? t('Surah')} {verseKey}
            </span>
            <span className="mushaf-tr-actions">
              <button
                type="button"
                className="mushaf-tr-action"
                aria-label={t('Copy ayah {key}', { key: verseKey })}
                onClick={(e) => {
                  e.stopPropagation()
                  void navigator.clipboard?.writeText(shareText).catch(() => {})
                }}
              >
                <Copy className="h-[15px] w-[15px]" />
              </button>
              <button
                type="button"
                className="mushaf-tr-action"
                aria-label={t('Share ayah {key}', { key: verseKey })}
                onClick={(e) => {
                  e.stopPropagation()
                  if (navigator.share) void navigator.share({ text: shareText }).catch(() => {})
                  else void navigator.clipboard?.writeText(shareText).catch(() => {})
                }}
              >
                <Share2 className="h-[15px] w-[15px]" />
              </button>
            </span>
          </div>
          <div className="mushaf-translation-arabic" dir="rtl" lang="ar">
            <p className="mushaf-translation-arabic-line mushaf-translation-arabic-line--plain min-h-[1.8em]" dir="rtl" lang="ar">
              {arabic || ' '}
            </p>
          </div>
          <p className="mushaf-translation-text" dir={isRtlTranslationEdition(edition) ? 'rtl' : undefined}>
            {translation === null ? t('Loading…') : translation || t('Translation unavailable.')}
          </p>
          {translation ? <p className="mushaf-tr-translator">— {option.label}</p> : null}
        </div>
      </article>
    </li>
  )
}
