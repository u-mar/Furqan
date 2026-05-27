'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  CheckCircle2,
  List,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { getBookmarks, type AyahBookmark } from '@/lib/bookmarks'
import { getChaptersMeta, chapterStartPage, type ChapterMeta } from '@/lib/chapters-meta'
import { buildQuarterMarkers, type QuarterMarker } from '@/lib/quarters'
import { getVerseByKey } from '@/lib/quran'
import { getVerseArabicText } from '@/lib/quran-display'
import { juzForChapter, revelationLabel } from '@/lib/mushaf'
import { KhatmahDrawerLayout } from '@/components/read/KhatmahPanel'
import type { Chapter } from '@/types'

type TopTab = 'chapters' | 'quarters'
type BottomNav = 'chapters' | 'khatmah' | 'bookmarks'

const QUARTERS_PER_JUZ = 8

interface ContentsDrawerProps {
  open: boolean
  chapters: Chapter[]
  currentSurahId: number
  onClose: () => void
  onSelectSurah: (chapterId: number) => void
  onGoToPage: (page: number) => void
}

function ProgressRing({ progress }: { progress: number }) {
  const pct = Math.min(1, Math.max(0, progress))
  const deg = pct * 360
  return (
    <span
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800"
      aria-hidden
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#14b8a6 ${deg}deg, #3f3f46 0deg)`,
        }}
      />
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[#0d0d0d] text-[10px] text-stone-400" />
    </span>
  )
}

const bottomItems: { id: BottomNav; label: string; Icon: typeof List }[] = [
  { id: 'chapters', label: 'Chapters', Icon: List },
  { id: 'khatmah', label: 'Khatmah', Icon: CheckCircle2 },
  { id: 'bookmarks', label: 'Bookmarks', Icon: Bookmark },
]

export default function ContentsDrawer({
  open,
  chapters,
  currentSurahId,
  onClose,
  onSelectSurah,
  onGoToPage,
}: ContentsDrawerProps) {
  const [topTab, setTopTab] = useState<TopTab>('chapters')
  const [bottomNav, setBottomNav] = useState<BottomNav>('chapters')
  const [meta, setMeta] = useState<ChapterMeta[]>([])
  const [quarters, setQuarters] = useState<QuarterMarker[]>([])
  const [previewText, setPreviewText] = useState<Record<string, string>>({})
  const [bookmarks, setBookmarks] = useState<AyahBookmark[]>([])

  useEffect(() => {
    if (!open) return
    getChaptersMeta()
      .then((m) => {
        setMeta(m)
        setQuarters(buildQuarterMarkers(m))
      })
      .catch(() => {})
  }, [open])

  const chaptersByPart = useMemo(() => {
    const groups = new Map<number, Chapter[]>()
    for (const chapter of chapters) {
      const part = juzForChapter(chapter.id)
      const list = groups.get(part) || []
      list.push(chapter)
      groups.set(part, list)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b)
  }, [chapters])

  const quartersByPart = useMemo(() => {
    const groups = new Map<number, QuarterMarker[]>()
    for (const q of quarters) {
      const list = groups.get(q.juz) || []
      list.push(q)
      groups.set(q.juz, list)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a - b)
  }, [quarters])

  useEffect(() => {
    if (!open || topTab !== 'quarters' || quarters.length === 0) return
    let cancelled = false
    const missing = quarters.filter((q) => !previewText[q.verseKey])
    const BATCH = 16

    void (async () => {
      for (let i = 0; i < missing.length; i += BATCH) {
        if (cancelled) return
        const batch = missing.slice(i, i + BATCH)
        const results = await Promise.all(
          batch.map(async (q) => {
            try {
              const verse = await getVerseByKey(q.verseKey)
              const text = getVerseArabicText(verse)
              return text ? { key: q.verseKey, text } : null
            } catch {
              return null
            }
          })
        )
        if (cancelled) return
        const updates: Record<string, string> = {}
        for (const row of results) {
          if (row) updates[row.key] = row.text
        }
        if (Object.keys(updates).length > 0) {
          setPreviewText((prev) => ({ ...prev, ...updates }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, topTab, quarters, previewText])

  useEffect(() => {
    if (!open || bottomNav !== 'bookmarks') return
    setBookmarks(getBookmarks())
  }, [open, bottomNav])

  if (!open) return null

  const showContentsHeader = bottomNav === 'chapters'

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/60"
        aria-label="Close contents"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,360px)] flex-col bg-[#0d0d0d] text-white shadow-2xl"
        role="dialog"
        aria-label="Contents"
      >
        {showContentsHeader && (
          <div className="flex items-center justify-end px-4 pt-4">
            <div className="mr-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTopTab('chapters')}
                className={cn(
                  'rounded-lg border px-4 py-2 text-xs font-bold tracking-wide',
                  topTab === 'chapters'
                    ? 'border-teal-500 text-teal-400'
                    : 'border-stone-600 text-stone-300'
                )}
              >
                CHAPTERS
              </button>
              <button
                type="button"
                onClick={() => setTopTab('quarters')}
                className={cn(
                  'rounded-lg border px-4 py-2 text-xs font-bold tracking-wide',
                  topTab === 'quarters'
                    ? 'border-teal-500 text-teal-400'
                    : 'border-stone-600 text-stone-300'
                )}
              >
                QUARTERS
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-stone-400 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {(bottomNav === 'khatmah' || bottomNav === 'bookmarks') && (
          <div className="flex justify-end px-4 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-stone-400 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {showContentsHeader && <h2 className="px-4 pt-2 text-2xl font-semibold">Contents</h2>}
        {bottomNav === 'bookmarks' && (
          <div className="px-4 pt-1">
            <h2 className="text-2xl font-semibold">Bookmarks</h2>
            <p className="mt-1 text-xs text-stone-500">Long-press an ayah to save it here.</p>
          </div>
        )}

        <div
          className={cn(
            'flex-1 min-h-0',
            bottomNav === 'khatmah'
              ? 'flex flex-col overflow-hidden'
              : 'overflow-y-auto px-2 pb-2 pt-2'
          )}
        >
          {bottomNav === 'khatmah' && (
            <KhatmahDrawerLayout
              onGoToPage={(page) => {
                onGoToPage(page)
              }}
              onClose={onClose}
            />
          )}

          {bottomNav === 'chapters' && topTab === 'chapters' &&
            chaptersByPart.map(([part, partChapters]) => (
              <div key={part} className="mb-4">
                <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Juz {part}
                </p>
                <ul>
                  {partChapters.map((chapter) => {
                    const active = chapter.id === currentSurahId
                    const startPage = meta.length
                      ? chapterStartPage(chapter.id, meta)
                      : 1
                    return (
                      <li key={chapter.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSurah(chapter.id)
                            onClose()
                          }}
                          className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-white/5"
                        >
                          <span
                            className={cn(
                              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium',
                              active ? 'bg-teal-600 text-white' : 'bg-stone-800 text-stone-300'
                            )}
                          >
                            {chapter.id}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-base font-medium text-white">
                              {chapter.englishName}
                            </span>
                            <span className="mt-0.5 block text-xs text-stone-500">
                              Page {startPage} · {chapter.versesCount} verses ·{' '}
                              {revelationLabel(chapter.id)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

          {bottomNav === 'chapters' && topTab === 'quarters' &&
            quartersByPart.map(([part, partQuarters]) => (
              <div key={part} className="mb-4">
                <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Juz {part}
                </p>
                <ul>
                  {partQuarters.map((q, idx) => {
                    const progress = (idx + 1) / QUARTERS_PER_JUZ
                    const showRing = idx > 0 && idx < partQuarters.length - 1
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onGoToPage(q.page)
                            onClose()
                          }}
                          className="flex w-full items-start gap-2 rounded-lg px-2 py-3 text-left hover:bg-white/5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-teal-400">
                              Quarter {q.indexInJuz} starts at {q.verseKey}
                            </p>
                            <p
                              className="arabic-text mt-1 line-clamp-2 text-xl leading-snug text-white"
                              dir="rtl"
                            >
                              {previewText[q.verseKey] || '…'}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              {q.surahName} · Ayah {q.ayah} · Page {q.page}
                            </p>
                          </div>
                          {showRing ? (
                            <ProgressRing progress={progress} />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800 text-sm text-stone-400">
                              {q.indexInJuz}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

          {bottomNav === 'bookmarks' && (
            <div className="px-2 pt-3">
              {bookmarks.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-stone-500">
                  No bookmarks yet. Long-press an ayah, then tap Bookmark.
                </p>
              ) : (
                <ul className="space-y-1">
                  {bookmarks.map((bookmark) => (
                    <li key={bookmark.verseKey}>
                      <button
                        type="button"
                        onClick={() => {
                          onGoToPage(bookmark.page)
                          onClose()
                        }}
                        className="flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left hover:bg-white/5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-800 text-teal-400">
                          <Bookmark className="h-4 w-4 fill-current" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-teal-400">
                            {bookmark.surahName} · Ayah {bookmark.ayah}
                          </span>
                          <span
                            className="arabic-text mt-1 line-clamp-2 block text-base leading-snug text-white"
                            dir="rtl"
                            lang="ar"
                          >
                            {bookmark.arabic}
                          </span>
                          <span className="mt-1 block text-xs text-stone-500">
                            {bookmark.verseKey} · Page {bookmark.page}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <nav className="flex shrink-0 items-end justify-around border-t border-white/10 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {bottomItems.map(({ id, label, Icon }) => {
            const active = bottomNav === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setBottomNav(id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]',
                  active ? 'text-teal-400' : 'text-stone-500'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.75} />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
