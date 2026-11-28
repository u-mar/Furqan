'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronRight, Copy, Loader2, Pause, Play, Share2 } from 'lucide-react'
import { useAppSettings } from '@/hooks/useAppSettings'
import { getOfflineTranslations } from '@/lib/offline-translations'
import { fetchPageTranslations } from '@/lib/qari-ayah'
import { getChapterAudio } from '@/lib/chapter-audio'
import { getPlayableAyahAudioUrl } from '@/lib/offline-audio'
import { getVerseByKey } from '@/lib/quran'
import { getReciterById, hasOwnAyahFiles } from '@/lib/reciters'
import { getTranslationOption, isRtlTranslationEdition } from '@/lib/translations'
import { tapFeedback } from '@/lib/haptics'
import { useLanguage, useT } from '@/lib/i18n'
import { cn } from '@/lib/cn'
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

const card = 'home-card ed-focus fx-press flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left'

function pageOf(verse: Verse): number {
  const first = verse.words?.[0]
  return first?.v2_page || first?.page_number || verse.page_number || 1
}

function verseText(verse: Verse): string {
  return verse.text_uthmani || (verse.words ?? []).filter((w) => w.char_type_name === 'word').map((w) => w.text_uthmani).join(' ')
}

/* ------------------------------------------------------------------ playing a topic's ayat */

/**
 * One topic's ayat, played one after another in Read's reciter: each from its own file, or from its
 * place in the reciter's whole-surah recording; a reciter with neither for an ayah is stood in for
 * by Alafasy. Kept outside the screen, so the row playing can be shown wherever it is.
 */
const player = {
  el: null as HTMLAudioElement | null,
  key: null as string | null,
  loading: false,
  stopAt: 0,
  queue: [] as string[],
  reciterId: '',
  session: 0,
  listeners: new Set<() => void>(),
}

function notify() {
  for (const listener of player.listeners) listener()
}

function audio(): HTMLAudioElement {
  if (player.el) return player.el
  const el = new Audio()
  el.preload = 'auto'
  el.addEventListener('timeupdate', () => {
    if (player.stopAt && el.currentTime >= player.stopAt) next()
  })
  el.addEventListener('ended', () => next())
  player.el = el
  return el
}

function next() {
  const at = player.key ? player.queue.indexOf(player.key) : -1
  const following = at >= 0 ? player.queue[at + 1] : undefined
  if (following) void play(following)
  else stopTopicAudio()
}

async function sourceFor(verseKey: string, reciterId: string): Promise<{ url: string; from: number; to: number } | null> {
  const [surah, ayah] = verseKey.split(':').map(Number)
  const reciter = getReciterById(reciterId)
  if (hasOwnAyahFiles(reciter)) {
    const url = await getPlayableAyahAudioUrl(reciterId, surah, ayah)
    if (url) return { url, from: 0, to: 0 }
  } else {
    const chapter = await getChapterAudio(reciterId, surah)
    const place = chapter?.byKey.get(verseKey)
    if (chapter && place) return { url: chapter.url, from: place.from / 1000, to: place.to / 1000 }
  }
  const url = await getPlayableAyahAudioUrl('alafasy', surah, ayah)
  return url ? { url, from: 0, to: 0 } : null
}

async function play(verseKey: string) {
  const session = ++player.session
  const el = audio()
  el.pause()
  player.key = verseKey
  player.loading = true
  player.stopAt = 0
  notify()
  const source = await sourceFor(verseKey, player.reciterId).catch(() => null)
  if (session !== player.session) return
  if (!source) {
    stopTopicAudio()
    return
  }
  if (el.src !== source.url) el.src = source.url
  try {
    // An ayah deep in a whole-surah recording (2:183 is an hour into Al-Baqarah) can only be reached
    // once the file's length is known: a jump made earlier is lost and it plays from the start.
    if (el.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          el.removeEventListener('loadedmetadata', done)
          el.removeEventListener('error', failed)
          resolve()
        }
        const failed = () => {
          el.removeEventListener('loadedmetadata', done)
          el.removeEventListener('error', failed)
          reject(new Error('audio'))
        }
        el.addEventListener('loadedmetadata', done)
        el.addEventListener('error', failed)
        el.load()
      })
    }
    if (session !== player.session) return
    el.currentTime = source.from
    player.stopAt = source.to
    await el.play()
    if (source.from && Math.abs(el.currentTime - source.from) > 2) el.currentTime = source.from
  } catch {
    if (session === player.session) stopTopicAudio()
    return
  }
  if (session !== player.session) return
  player.loading = false
  notify()
}

/** Plays `verseKey`, then the ayat after it in `queue`. */
export function playTopicAyah(verseKey: string, queue: string[], reciterId: string) {
  player.queue = queue
  player.reciterId = reciterId
  void play(verseKey)
}

export function stopTopicAudio() {
  player.session++
  player.el?.pause()
  player.key = null
  player.loading = false
  player.stopAt = 0
  notify()
}

function useTopicPlaying(): { key: string | null; loading: boolean } {
  const key = useSyncExternalStore(
    (listener) => {
      player.listeners.add(listener)
      return () => player.listeners.delete(listener)
    },
    () => (player.key ? `${player.key}|${player.loading ? 1 : 0}` : ''),
    () => ''
  )
  const [verseKey, loading] = key ? key.split('|') : [null, '0']
  return { key: verseKey, loading: loading === '1' }
}

/* ------------------------------------------------------------------ the tab */

export default function TopicsTab({
  query,
  chapters,
  onGoToPage,
  path,
  onPathChange,
  onTitle,
  onBeforePlay,
}: {
  query: string
  chapters: Chapter[]
  onGoToPage: (page: number, verseKey: string) => void
  /** The topics opened, from the top level down: the Contents page's header shows the last one and goes back up. */
  path: number[]
  onPathChange: (path: number[]) => void
  /** The open topic's name, for that header (null at the top level). */
  onTitle: (title: string | null) => void
  /** Read's own recitation is stopped before a topic's ayah plays. */
  onBeforePlay?: () => void
}) {
  const t = useT()
  const language = useLanguage()
  const settings = useAppSettings()
  const [topics, setTopics] = useState<TopicData | null>(null)
  const top = useRef<HTMLDivElement>(null)
  const setPath = (next: number[] | ((p: number[]) => number[])) => onPathChange(typeof next === 'function' ? next(path) : next)

  useEffect(() => {
    void loadTopics().then(setTopics).catch(() => {})
  }, [])

  // Leaving the tab, or the Contents page, stops a topic's ayah playing.
  useEffect(() => () => stopTopicAudio(), [])

  // A new search starts from the top level.
  useEffect(() => {
    if (query) onPathChange([])
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

  const openId = path[path.length - 1]
  const title = openId && topics ? name(openId) : null
  useEffect(() => {
    onTitle(title)
  }, [title, onTitle])

  if (!topics) return <p className="px-6 py-14 text-center text-sm text-[var(--home-muted)]">{t('Loading…')}</p>

  const open = (id: number) => {
    tapFeedback()
    setPath((p) => [...p, id])
    top.current?.scrollIntoView({ block: 'start' })
  }

  const row = (id: number) => {
    const topic = topics.topics[String(id)]
    if (!topic) return null
    return (
      <li key={id}>
        <button type="button" onClick={() => open(id)} className={card}>
          <span className="min-w-0 flex-1 text-[0.96875rem] font-semibold leading-snug text-[var(--home-heading)]">{name(id)}</span>
          <span className="shrink-0 text-[0.8125rem] tabular-nums text-[var(--home-muted)]">{topic.count}</span>
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
          <ul className="space-y-2">{results.map(row)}</ul>
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
            <ul className="space-y-2">{(topics.topics[String(root)]?.children ?? []).map(row)}</ul>
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
      {topic?.children?.length ? <ul className="mb-5 space-y-2">{topic.children.map(row)}</ul> : null}
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
              <AyahRow
                key={key}
                verseKey={key}
                chapters={chapters}
                onGoToPage={onGoToPage}
                onPlay={() => {
                  onBeforePlay?.()
                  playTopicAyah(key, topic.ayahs ?? [], settings.reciterId)
                }}
              />
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
function AyahRow({
  verseKey,
  chapters,
  onGoToPage,
  onPlay,
}: {
  verseKey: string
  chapters: Chapter[]
  onGoToPage: (page: number, verseKey: string) => void
  onPlay: () => void
}) {
  const t = useT()
  const playing = useTopicPlaying()
  const isPlaying = playing.key === verseKey
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

  // The ayah playing is kept in view as the recitation moves on through the topic.
  useEffect(() => {
    if (isPlaying) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isPlaying])

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
          stopTopicAudio()
          const v = verse ?? (await getVerseByKey(verseKey).catch(() => null))
          onGoToPage(v ? pageOf(v) : 1, verseKey)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLElement).click()
        }}
        className="ed-focus cursor-pointer"
      >
        <div className={cn('mushaf-translation-body px-2.5 py-6', isPlaying && 'mushaf-translation-body--reciting')}>
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
                aria-label={isPlaying ? t('Pause') : t('Play ayah {key}', { key: verseKey })}
                onClick={(e) => {
                  e.stopPropagation()
                  tapFeedback()
                  if (isPlaying) stopTopicAudio()
                  else onPlay()
                }}
              >
                {isPlaying && playing.loading ? (
                  <Loader2 className="h-[15px] w-[15px] animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-[15px] w-[15px] fill-current" />
                ) : (
                  <Play className="h-[15px] w-[15px] fill-current" />
                )}
              </button>
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
