'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Search, Square, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useArabicVoiceInput } from '@/hooks/useArabicVoiceInput'
import { loadQuranData } from '@/lib/quran'
import { searchAyahs, type AyahSearchResult } from '@/lib/search-ayahs'
import { filterChapters } from '@/lib/search-chapters'
import type { Chapter, Verse } from '@/types'
import { useT } from '@/lib/i18n'

type SearchMode = 'surah' | 'ayah'

interface SurahSearchModalProps {
  open: boolean
  chapters: Chapter[]
  currentSurahId?: number
  onClose: () => void
  onSelectSurah: (chapterId: number) => void
  onSelectAyah: (verseKey: string) => void
}

export default function SurahSearchModal({
  open,
  chapters,
  currentSurahId,
  onClose,
  onSelectSurah,
  onSelectAyah,
}: SurahSearchModalProps) {
  const t = useT()
  const [mode, setMode] = useState<SearchMode>('surah')
  const [query, setQuery] = useState('')
  const [ayahQuery, setAyahQuery] = useState('')
  const [verses, setVerses] = useState<Verse[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const voice = useArabicVoiceInput((text) => setAyahQuery(text))

  useEffect(() => {
    if (!open) {
      setQuery('')
      setAyahQuery('')
      setMode('surah')
      voice.stop()
      return
    }
    const id = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // The full Quran text is only needed for ayah search — load it once, the
  // first time someone actually switches to that tab, not on every open.
  useEffect(() => {
    if (mode !== 'ayah' || verses) return
    let cancelled = false
    void loadQuranData().then((data) => {
      if (!cancelled) setVerses(data.verses)
    })
    return () => {
      cancelled = true
    }
  }, [mode, verses])

  const chapterNameById = useMemo(
    () => Object.fromEntries(chapters.map((c) => [c.id, c.englishName])),
    [chapters]
  )

  const surahResults = useMemo(() => filterChapters(chapters, query), [chapters, query])
  const ayahResults = useMemo<AyahSearchResult[]>(
    () => (verses ? searchAyahs(verses, ayahQuery) : []),
    [verses, ayahQuery]
  )

  if (!open) return null

  const switchMode = (next: SearchMode) => {
    if (next === mode) return
    voice.stop()
    setMode(next)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        aria-label={t('Close search')}
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 top-0 z-50 mx-auto flex max-h-[100dvh] w-full max-w-lg flex-col bg-[#0d0d0d] shadow-2xl lg:inset-x-auto lg:left-1/2 lg:top-[8vh] lg:max-h-[84vh] lg:w-[min(100%,480px)] lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:border-white/10"
        role="dialog"
        aria-modal="true"
        aria-label={t('Search surah')}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:rounded-t-2xl lg:pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[#1a1a1a] px-3 py-2.5">
            <Search className="h-5 w-5 shrink-0 text-stone-500" aria-hidden />
            {mode === 'surah' ? (
              <input
                key="surah"
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('Search surah by name or number…')}
                className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-stone-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                autoComplete="off"
                enterKeyHint="search"
              />
            ) : (
              <input
                key="ayah"
                ref={inputRef}
                type="search"
                dir="rtl"
                value={ayahQuery}
                onChange={(e) => setAyahQuery(e.target.value)}
                placeholder={t('Type an ayah in Arabic…')}
                className="amiri min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-stone-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                autoComplete="off"
                enterKeyHint="search"
              />
            )}
            {(mode === 'surah' ? query : ayahQuery).length > 0 && (
              <button
                type="button"
                onClick={() => (mode === 'surah' ? setQuery('') : setAyahQuery(''))}
                className="rounded-full p-1 text-stone-500 hover:bg-white/10 hover:text-stone-300"
                aria-label={t('Clear search')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {mode === 'ayah' && voice.state !== 'unsupported' ? (
              <button
                type="button"
                onClick={() => (voice.state === 'listening' ? voice.stop() : voice.start())}
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  voice.state === 'listening' ? 'bg-rose-600 text-white' : 'text-stone-500 hover:bg-white/10 hover:text-stone-300'
                )}
                aria-label={voice.state === 'listening' ? t('Stop listening') : t('Speak the ayah')}
                aria-pressed={voice.state === 'listening'}
              >
                {voice.state === 'listening' ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-teal-400 hover:bg-white/5"
          >
            {t('Cancel')}</button>
        </div>

        <div className="flex gap-1.5 px-3 py-2.5">
          {(['surah', 'ayah'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchMode(tab)}
              aria-pressed={mode === tab}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[0.8125rem] font-semibold transition-colors',
                mode === tab ? 'bg-teal-600 text-white' : 'bg-[#1a1a1a] text-stone-400 hover:text-stone-200'
              )}
            >
              {tab === 'surah' ? t('Surahs') : t('Ayahs')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          {mode === 'surah' ? (
            chapters.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-stone-500">{t('Loading surahs…')}</p>
            ) : surahResults.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm text-stone-500">
                {t('No surah found for “{query}”', { query })}</p>
            ) : (
              <ul>
                {surahResults.map((chapter) => {
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
                          {chapter.versesCount} {t('ayahs')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          ) : !verses ? (
            <p className="px-4 py-12 text-center text-sm text-stone-500">{t('Loading the Quran text…')}</p>
          ) : ayahQuery.trim().length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-stone-500">{t('Type a few words from the ayah, in Arabic.')}</p>
          ) : ayahResults.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-stone-500">{t('No ayah found for that.')}</p>
          ) : (
            <ul>
              {ayahResults.map((result) => {
                const [surahId, ayah] = result.verseKey.split(':')
                const active = result.verseKey.startsWith(`${currentSurahId}:`) && Number(surahId) === currentSurahId
                return (
                  <li key={result.verseKey}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectAyah(result.verseKey)
                        onClose()
                      }}
                      className={cn(
                        'flex w-full flex-col gap-1 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-white/5',
                        active && 'bg-teal-950/40'
                      )}
                    >
                      <span className="amiri text-right text-lg leading-relaxed text-white" dir="rtl">
                        {result.arabic}
                      </span>
                      <span className="text-xs text-teal-400/90">
                        {chapterNameById[Number(surahId)] || t('Surah {surahId}', { surahId })} · {surahId}:{ayah}
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
