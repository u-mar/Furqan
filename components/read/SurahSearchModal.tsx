'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { filterChapters } from '@/lib/search-chapters'
import type { Chapter } from '@/types'

interface SurahSearchModalProps {
  open: boolean
  chapters: Chapter[]
  currentSurahId?: number
  onClose: () => void
  onSelectSurah: (chapterId: number) => void
}

export default function SurahSearchModal({
  open,
  chapters,
  currentSurahId,
  onClose,
  onSelectSurah,
}: SurahSearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const results = useMemo(() => filterChapters(chapters, query), [chapters, query])

  if (!open) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        aria-label="Close search"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[100dvh] w-full max-w-lg flex-col bg-[#0d0d0d] shadow-2xl lg:inset-x-auto lg:left-1/2 lg:top-[8vh] lg:max-h-[84vh] lg:w-[min(100%,480px)] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-white/10"
        role="dialog"
        aria-modal="true"
        aria-label="Search surah"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:rounded-t-2xl lg:pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <Search className="h-5 w-5 shrink-0 text-stone-500" aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search surah by name or number…"
              className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-stone-500 focus:outline-none"
              autoComplete="off"
              enterKeyHint="search"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-full p-1 text-stone-500 hover:bg-white/10 hover:text-stone-300"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-teal-400 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {chapters.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-stone-500">Loading surahs…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-stone-500">
              No surah found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <ul>
              {results.map((chapter) => {
                const active = chapter.id === currentSurahId
                return (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSurah(chapter.id)
                        onClose()
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/5',
                        active && 'bg-teal-950/40'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                          active ? 'bg-teal-600 text-white' : 'bg-stone-800 text-stone-300'
                        )}
                      >
                        {chapter.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-white">
                          {chapter.englishName}
                        </span>
                        <span className="amiri mt-0.5 block truncate text-sm text-teal-400/90">
                          {chapter.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-stone-500">
                        {chapter.versesCount} ayahs
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
