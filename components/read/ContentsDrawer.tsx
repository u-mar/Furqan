'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bookmark, CheckCircle2, List, Menu, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getBookmarks, type AyahBookmark } from '@/lib/bookmarks'
import { getChaptersMeta, type ChapterMeta } from '@/lib/chapters-meta'
import { tapFeedback } from '@/lib/haptics'
import { buildQuarterMarkers, type QuarterMarker } from '@/lib/quarters'
import { JUZ_START_PAGES, revelationLabel } from '@/lib/mushaf'
import { loadPageFont } from '@/lib/mushaf-fonts'
import { KhatmahDrawerLayout } from '@/components/read/KhatmahPanel'
import QuarterAyahPreview from '@/components/read/QuarterAyahPreview'
import TopicsTab from '@/components/read/TopicsTab'
import type { Chapter } from '@/types'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'
import { lockPageScroll } from '@/lib/scroll-lock'

/**
 * Read's contents, as a page of its own: the Quran by surah, by quarter (hizb quarters) and by juz,
 * each a list of cards with a search at the top; and, from the bar at the bottom, the khatmah and
 * your bookmarks.
 */

type TopTab = 'surah' | 'quarters' | 'juz' | 'topic'
type BottomNav = 'chapters' | 'khatmah' | 'bookmarks'

const TABS: Array<[TopTab, string]> = [
  ['surah', 'Surah'],
  ['quarters', 'Quarters'],
  ['juz', 'Juz'],
  ['topic', 'Topic'],
]

/** ¼, ½, ¾ and the start of a hizb, as a quarter's place in its hizb. */
const QUARTER_MARKS = ['●', '¼', '½', '¾']

interface ContentsDrawerProps {
  open: boolean
  chapters: Chapter[]
  currentSurahId: number
  onClose: () => void
  onSelectSurah: (chapterId: number) => void
  /** `highlight`: the ayah is only marked on its page, without opening its menu (a bookmark). */
  onGoToPage: (page: number, verseKey?: string, options?: { highlight?: boolean }) => void
  /** Stops Read's own recitation, before an ayah in Topic plays. */
  onBeforePlay?: () => void
}

const bottomItems: { id: BottomNav; label: string; Icon: typeof List }[] = [
  { id: 'chapters', label: 'Chapters', Icon: List },
  { id: 'khatmah', label: 'Khatmah', Icon: CheckCircle2 },
  { id: 'bookmarks', label: 'Bookmarks', Icon: Bookmark },
]

const card = 'home-card ed-focus fx-press flex min-h-[4rem] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left'

export default function ContentsDrawer({ open, chapters, currentSurahId, onClose, onSelectSurah, onGoToPage, onBeforePlay }: ContentsDrawerProps) {
  const t = useT()
  useCloseOnBack(open, onClose)
  const [tab, setTab] = useState<TopTab>('surah')
  const [bottomNav, setBottomNav] = useState<BottomNav>('chapters')
  const [meta, setMeta] = useState<ChapterMeta[]>([])
  const [quarters, setQuarters] = useState<QuarterMarker[]>([])
  const [bookmarks, setBookmarks] = useState<AyahBookmark[]>([])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  // Topic: the topics opened, and the open one's name, which takes the header's place.
  const [topicPath, setTopicPath] = useState<number[]>([])
  const [topicTitle, setTopicTitle] = useState<string | null>(null)
  const onTopicTitle = useCallback((title: string | null) => setTopicTitle(title), [])
  const onTopicTab = tab === 'topic' && bottomNav === 'chapters'
  const inTopic = onTopicTab && topicPath.length > 0
  // On Topic the title says "Topic", as Read's says the surah; tapping it shows the four tabs.
  const [topicTabsOpen, setTopicTabsOpen] = useState(false)
  useEffect(() => setTopicTabsOpen(false), [topicPath])
  const searchInput = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const unlock = lockPageScroll()
    getChaptersMeta()
      .then((m) => {
        setMeta(m)
        setQuarters(buildQuarterMarkers(m))
      })
      .catch(() => {})
    return unlock
  }, [open])

  useEffect(() => {
    if (open) return
    setSearching(false)
    setQuery('')
    setTopicPath([])
  }, [open])

  // A new tab starts at its top, with the search cleared.
  useEffect(() => {
    setQuery('')
    list.current?.scrollTo({ top: 0 })
  }, [tab])

  // The surah being read is brought into view when the list opens.
  useEffect(() => {
    if (!open || tab !== 'surah' || bottomNav !== 'chapters') return
    const frame = requestAnimationFrame(() => {
      list.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'center' })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, tab, bottomNav])

  useEffect(() => {
    if (searching) searchInput.current?.focus()
  }, [searching])

  useEffect(() => {
    if (!open || bottomNav !== 'bookmarks') return
    const saved = getBookmarks()
    setBookmarks(saved)
    // Bookmarked ayat can be on a page that has never been read, so its QCF font may not be loaded yet.
    for (const bookmark of saved) {
      if (bookmark.qcfGlyphs) void loadPageFont(bookmark.page, bookmark.qcfGlyphs)
    }
  }, [open, bottomNav])

  const q = query.trim().toLowerCase()
  const metaById = useMemo(() => new Map(meta.map((m) => [m.id, m])), [meta])

  const surahs = useMemo(() => {
    if (!q) return chapters
    return chapters.filter((c) => {
      const m = metaById.get(c.id)
      return (
        String(c.id) === q ||
        c.englishName.toLowerCase().replace(/['-]/g, '').includes(q.replace(/['-]/g, '')) ||
        (m?.name_arabic ?? '').includes(query.trim())
      )
    })
  }, [chapters, metaById, q, query])

  const quartersByJuz = useMemo(() => {
    const shown = q
      ? quarters.filter((m) => String(m.juz) === q || m.surahName.toLowerCase().includes(q) || m.verseKey === q)
      : quarters
    const groups = new Map<number, QuarterMarker[]>()
    for (const m of shown) groups.set(m.juz, [...(groups.get(m.juz) ?? []), m])
    return [...groups.entries()].sort(([a], [b]) => a - b)
  }, [quarters, q])

  /** Each juz with where it begins (its first quarter). */
  const juzList = useMemo(() => {
    const all = Array.from({ length: 30 }, (_, i) => {
      const juz = i + 1
      const first = quarters.find((m) => m.juz === juz && m.indexInJuz === 1)
      return { juz, first, page: first?.page ?? JUZ_START_PAGES[i] ?? 1 }
    })
    if (!q) return all
    return all.filter((j) => String(j.juz) === q || (j.first?.surahName ?? '').toLowerCase().includes(q))
  }, [quarters, q])

  if (!open) return null

  const go = (page: number, verseKey?: string, options?: { highlight?: boolean }) => {
    tapFeedback()
    onClose()
    onGoToPage(page, verseKey, options)
  }

  const empty = <p className="px-6 py-14 text-center text-sm text-[var(--home-muted)]">{t('Nothing matches that.')}</p>

  return (
    <div
      className={cn(
        'qari-sheet fixed inset-0 z-50 flex flex-col',
        // Topic reads like Read itself: its page colour and ink.
        tab === 'topic' && bottomNav === 'chapters' ? 'bg-[var(--mushaf-read-bg)] text-[var(--mushaf-read-text)]' : 'bg-[var(--app-bg)] text-[var(--app-text)]'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={t('Contents')}
    >
      <div className={cn('shrink-0', (!onTopicTab || topicTabsOpen) && 'border-b border-[var(--home-rule)]')}>
        <div className="mx-auto w-full max-w-lg px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <header className="flex h-14 items-center gap-3">
            {onTopicTab ? (
              // On Topic, as in Read, ☰ is always at hand: it shows the four tabs.
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  setTopicTabsOpen((v) => !v)
                }}
                aria-expanded={topicTabsOpen}
                className="ed-focus -ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--mushaf-read-accent)]"
                aria-label={t('Open contents')}
              >
                <Menu className="h-6 w-6" strokeWidth={2} />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="ed-focus -ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--home-heading)]"
                aria-label={t('Close')}
              >
                <ArrowLeft className="h-6 w-6" strokeWidth={2} />
              </button>
            )}
            {searching && bottomNav === 'chapters' && !inTopic ? (
              <input
                ref={searchInput}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                inputMode="search"
                enterKeyHint="search"
                placeholder={tab === 'surah' ? t('Search surah') : tab === 'juz' ? t('Juz number or surah') : tab === 'topic' ? t('Search topic') : t('Surah or juz')}
                aria-label={t('Search')}
                className="h-10 min-w-0 flex-1 bg-transparent text-[1.1875rem] text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
              />
            ) : (
              onTopicTab ? (
                <h2 className="min-w-0 flex-1 truncate text-[1.375rem] font-semibold text-[var(--home-heading)]">{t('Topic')}</h2>
              ) : (
                <h2 className="min-w-0 flex-1 truncate text-[1.375rem] font-semibold text-[var(--home-heading)]">
                  {bottomNav === 'khatmah' ? t('Khatmah') : bottomNav === 'bookmarks' ? t('Bookmarks') : t('Quran')}
                </h2>
              )
            )}
            {bottomNav === 'chapters' && !inTopic ? (
              <button
                type="button"
                onClick={() => {
                  setSearching((v) => !v)
                  setQuery('')
                }}
                className="ed-focus -mr-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--home-heading)]"
                aria-label={searching ? t('Close search') : t('Search')}
              >
                {searching ? <X className="h-[21px] w-[21px]" strokeWidth={2} /> : <Search className="h-6 w-6" strokeWidth={2} />}
              </button>
            ) : null}
            {onTopicTab ? (
              <button
                type="button"
                onClick={onClose}
                className="ed-focus -mr-1 flex h-10 w-10 items-center justify-center rounded-full text-[var(--home-heading)]"
                aria-label={t('Close')}
              >
                <X className="h-[22px] w-[22px]" strokeWidth={2} />
              </button>
            ) : null}
          </header>
          {bottomNav === 'chapters' && (!onTopicTab || topicTabsOpen) ? (
            <nav className="mt-2 flex gap-8" aria-label={t('Contents')}>
              {TABS.map(([id, label]) => {
                const on = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      tapFeedback()
                      setTab(id)
                      // Topic, from inside a topic: back to all the topics.
                      if (id === 'topic') setTopicPath([])
                      setTopicTabsOpen(false)
                    }}
                    aria-pressed={on}
                    className={cn(
                      'relative pb-3.5 pt-2 text-[1.0625rem] transition-colors',
                      on ? 'font-semibold text-[var(--home-heading)]' : 'text-[var(--home-muted)]'
                    )}
                  >
                    {t(label)}
                    <span
                      className={cn('absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-[var(--mushaf-read-accent)] transition-opacity', on ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                  </button>
                )
              })}
            </nav>
          ) : null}
        </div>
      </div>

      <div ref={list} className={cn('min-h-0 flex-1', bottomNav === 'khatmah' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain')}>
        {bottomNav === 'khatmah' ? (
          <KhatmahDrawerLayout onGoToPage={(page) => onGoToPage(page)} onClose={onClose} />
        ) : (
          <div className="mx-auto w-full max-w-lg px-4 pb-6 pt-4">
            {bottomNav === 'chapters' && tab === 'surah' ? (
              surahs.length ? (
                <ul className="space-y-2">
                  {surahs.map((chapter) => {
                    const active = chapter.id === currentSurahId
                    const m = metaById.get(chapter.id)
                    return (
                      <li key={chapter.id}>
                        <button
                          type="button"
                          aria-current={active || undefined}
                          onClick={() => {
                            tapFeedback()
                            onSelectSurah(chapter.id)
                            onClose()
                          }}
                          className={card}
                          // The card's own shadow would hide a ring: the outline of the surah being read is its shadow.
                          style={active ? { boxShadow: 'inset 0 0 0 1.5px var(--mushaf-read-accent)' } : undefined}
                        >
                          <span className="w-8 shrink-0 text-[1rem] font-semibold tabular-nums text-[var(--mushaf-read-accent)]">
                            {String(chapter.id).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.96875rem] font-semibold text-[var(--home-heading)]">{chapter.englishName}</span>
                            <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--home-muted)]">
                              {t(revelationLabel(chapter.id))} · {chapter.versesCount} {t('ayahs')}
                            </span>
                          </span>
                          {m?.name_arabic ? (
                            <span className="arabic-text shrink-0 text-[1.25rem] leading-none text-[var(--home-heading)]" dir="rtl" lang="ar">
                              {m.name_arabic}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                empty
              )
            ) : null}

            {bottomNav === 'chapters' && tab === 'quarters' ? (
              quartersByJuz.length ? (
                quartersByJuz.map(([juz, items]) => (
                  <section key={juz} className="mb-4">
                    <h3 className="home-label mx-1 mb-2.5 mt-3">
                      {t('Juz')} {juz}
                    </h3>
                    <ul className="space-y-2">
                      {items.map((m) => (
                        <li key={m.id}>
                          <button type="button" onClick={() => go(m.page, m.verseKey)} className={card}>
                            <span className="w-8 shrink-0 text-center text-[1.0625rem] font-semibold text-[var(--mushaf-read-accent)]" aria-hidden>
                              {QUARTER_MARKS[(m.indexInJuz - 1) % 4]}
                            </span>
                            <span className="min-w-0 flex-1">
                              <QuarterAyahPreview
                                verseKey={m.verseKey}
                                className="flex h-[1.75em] flex-wrap justify-start gap-y-[3em] overflow-hidden text-[1.125rem] leading-snug text-[var(--home-heading)]"
                              />
                              <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--home-muted)]">
                                {t('Hizb')} {(juz - 1) * 2 + Math.ceil(m.indexInJuz / 4)} · {m.surahName} {m.ayah} · {t('Page')} {m.page}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              ) : (
                empty
              )
            ) : null}

            {bottomNav === 'chapters' && tab === 'juz' ? (
              juzList.length ? (
                <ul className="space-y-2">
                  {juzList.map((j) => (
                    <li key={j.juz}>
                      <button type="button" onClick={() => go(j.page, j.first?.verseKey)} className={card}>
                        <span className="w-8 shrink-0 text-[1rem] font-semibold tabular-nums text-[var(--mushaf-read-accent)]">
                          {String(j.juz).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.96875rem] font-semibold text-[var(--home-heading)]">
                            {t('Juz')} {j.juz}
                          </span>
                          <span className="mt-0.5 block truncate text-[0.8125rem] text-[var(--home-muted)]">
                            {j.first ? `${j.first.surahName} ${j.first.ayah}` : `${t('Page')} ${j.page}`}
                          </span>
                        </span>
                        {j.first ? (
                          <QuarterAyahPreview
                            verseKey={j.first.verseKey}
                            className="flex h-[1.75em] max-w-[42%] shrink-0 flex-wrap justify-end gap-y-[3em] overflow-hidden text-[1.0625rem] leading-snug text-[var(--home-heading)]"
                          />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                empty
              )
            ) : null}

            {bottomNav === 'chapters' && tab === 'topic' ? (
              <>
              {inTopic && topicTitle ? (
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback()
                    setTopicPath((p) => p.slice(0, -1))
                    list.current?.scrollTo({ top: 0 })
                  }}
                  className="ed-focus -mx-1 mb-3 flex items-center gap-2 rounded-lg px-1 py-1 text-left"
                  aria-label={`${t('Back')}: ${topicTitle}`}
                >
                  <ArrowLeft className="h-5 w-5 shrink-0 text-[var(--home-heading)]" strokeWidth={2} />
                  <span className="text-[1.0625rem] font-semibold leading-snug text-[var(--home-heading)]">{topicTitle}</span>
                </button>
              ) : null}
              <TopicsTab
                query={query}
                chapters={chapters}
                onGoToPage={(page, verseKey) => go(page, verseKey)}
                path={topicPath}
                onPathChange={(path) => {
                  setTopicPath(path)
                  list.current?.scrollTo({ top: 0 })
                }}
                onTitle={onTopicTitle}
                onBeforePlay={onBeforePlay}
              />
              </>
            ) : null}

            {bottomNav === 'bookmarks' ? (
              bookmarks.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-[var(--home-muted)]">{t('No bookmarks yet. Double-tap an ayah, then tap Bookmark.')}</p>
              ) : (
                <ul className="space-y-2">
                  {bookmarks.map((bookmark) => (
                    <li key={bookmark.verseKey}>
                      <button type="button" onClick={() => go(bookmark.page, bookmark.verseKey, { highlight: true })} className={cn(card, 'items-start')}>
                        <Bookmark className="mt-0.5 h-[18px] w-[18px] shrink-0 fill-current text-[var(--mushaf-read-accent)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.8125rem] font-semibold text-[var(--mushaf-read-accent)]">
                            {bookmark.surahName} {t('· Ayah')} {bookmark.ayah}
                          </span>
                          {bookmark.qcfGlyphs && bookmark.qcfFontFamily ? (
                            <span
                              className="mt-1 line-clamp-2 block text-xl leading-snug text-[var(--home-heading)]"
                              dir="rtl"
                              lang="ar"
                              style={{
                                fontFamily: `'${bookmark.qcfFontFamily}', serif`,
                                fontFeatureSettings: 'normal',
                                fontVariantLigatures: 'normal',
                                fontKerning: 'none',
                              }}
                            >
                              {bookmark.qcfGlyphs}
                            </span>
                          ) : (
                            <span className="arabic-text mt-1 line-clamp-2 block text-base leading-snug text-[var(--home-heading)]" dir="rtl" lang="ar">
                              {bookmark.arabic}
                            </span>
                          )}
                          <span className="mt-1 block text-[0.8125rem] text-[var(--home-muted)]">
                            {bookmark.verseKey} {t('· Page')} {bookmark.page}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        )}
      </div>

      {tab === 'topic' && bottomNav === 'chapters' ? null : (
      <nav className="flex shrink-0 items-end justify-around border-t border-[var(--home-rule)] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {bottomItems.map(({ id, label, Icon }) => {
          const active = bottomNav === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (!active) tapFeedback()
                setBottomNav(id)
                setSearching(false)
                setQuery('')
              }}
              className={cn('flex flex-col items-center gap-1 px-3 py-1 text-[0.75rem]', active ? 'text-[var(--mushaf-read-accent)]' : 'text-[var(--home-muted)]')}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.8} />
              {t(label)}
            </button>
          )
        })}
      </nav>
      )}
    </div>
  )
}
