'use client'

import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Search } from 'lucide-react'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { tapFeedback } from '@/lib/haptics'
import { getChapters } from '@/lib/quran'
import { filterChapters } from '@/lib/search-chapters'
import { useT } from '@/lib/i18n'
import type { Chapter } from '@/types'

const JUZ_LIST = Array.from({ length: 30 }, (_, i) => i + 1)

/** A calm rotation of the app's home palette so the juz grid isn't 30
 *  identical grey squares — purely decorative, no meaning per number. */
const JUZ_TINTS = [
  { bg: 'var(--home-sage-soft)', fg: 'var(--home-sage-deep)' },
  { bg: 'rgba(197, 165, 84, 0.14)', fg: '#8a6d1f' },
  { bg: 'rgba(92, 148, 196, 0.14)', fg: '#2f6493' },
  { bg: 'rgba(196, 108, 92, 0.13)', fg: '#a3452f' },
]

interface SurahJuzPickerProps {
  open: boolean
  onClose: () => void
  title: string
  onSelectSurah: (chapter: Chapter) => void
  /** Omit to hide the Juz tab entirely (e.g. Sabaq, which reads a surah start to finish). */
  onSelectJuz?: (juz: number) => void
  /** Which tab to land on when it opens — e.g. a "Juz" tile should open straight to Juz. */
  initialTab?: 'surah' | 'juz'
}

/**
 * The shared "which ayah" picker for Hifdh Test — search-filtered surah list
 * (icon, English + Arabic name, ayah count) and, when offered, a coloured
 * juz grid. One component so Sabaq and Surprise ayah never drift apart.
 */
export default function SurahJuzPicker({
  open,
  onClose,
  title,
  onSelectSurah,
  onSelectJuz,
  initialTab = 'surah',
}: SurahJuzPickerProps) {
  const t = useT()
  const [tab, setTab] = useState<'surah' | 'juz'>(initialTab)
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open && !chapters) void getChapters().then(setChapters)
  }, [open, chapters])

  useEffect(() => {
    if (open) setTab(initialTab)
    else setQuery('')
    // Only sync on open/close, not on every initialTab change — switching
    // tabs inside the sheet shouldn't get stomped by the caller's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const filtered = useMemo(() => (chapters ? filterChapters(chapters, query) : []), [chapters, query])

  return (
    <SettingsSheet open={open} title={title} onClose={onClose}>
      {onSelectJuz ? (
        <div className="mb-3 flex justify-center">
          <div role="group" aria-label={t('Scope')} className="ed-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            {(['surah', 'juz'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={tab === s}
                onClick={() => {
                  tapFeedback()
                  setTab(s)
                }}
                className="ed-seg__item ed-focus flex h-9 items-center justify-center px-4 text-[0.8125rem] font-semibold"
              >
                {s === 'surah' ? t('Surah') : t('Juz')}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'surah' ? (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--home-muted)]" strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Search a surah…')}
              className="h-11 w-full rounded-xl border border-[var(--home-rule-strong)] bg-transparent pl-10 pr-3.5 text-[0.9375rem] text-[var(--app-text)] placeholder:text-[var(--home-muted)] focus:border-[var(--home-sage)] focus:outline-none"
            />
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            {!chapters ? (
              <p className="px-2 py-8 text-center text-sm text-[var(--home-muted)]">{t('Loading surahs…')}</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-[var(--home-muted)]">{t('No surahs found for that.')}</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        tapFeedback()
                        onSelectSurah(c)
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-[var(--home-track)]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--home-sage-soft)] text-[0.8125rem] font-semibold text-[var(--home-sage-deep)]">
                        {c.id}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-medium text-[var(--home-heading)]">
                          {c.englishName}
                        </span>
                        <span className="amiri mt-0.5 block truncate text-sm text-[var(--home-sage-deep)]">{c.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--home-muted)]">
                        <BookOpen className="h-3.5 w-3.5" strokeWidth={1.9} />
                        {c.versesCount}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <ul className="grid max-h-[56vh] grid-cols-3 gap-2 overflow-y-auto p-1">
          {JUZ_LIST.map((j) => {
            const tint = JUZ_TINTS[j % JUZ_TINTS.length]
            return (
              <li key={j}>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback()
                    onSelectJuz?.(j)
                  }}
                  style={{ background: tint.bg, color: tint.fg }}
                  className="ed-focus fx-press flex h-14 w-full flex-col items-center justify-center rounded-xl text-[0.6875rem] font-semibold"
                >
                  <span className="text-[1.0625rem]">{j}</span>
                  <span className="opacity-80">{t('Juz')}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </SettingsSheet>
  )
}
