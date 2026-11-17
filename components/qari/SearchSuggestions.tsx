'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpLeft, Search } from 'lucide-react'
import QariAvatar from '@/components/qari/QariAvatar'
import { fetchSuggestions, type QariSuggestions } from '@/lib/qari'
import { normalizeText } from '@/lib/fuzzy-match'
import { tapFeedback } from '@/lib/haptics'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/** Shows what was typed in bold inside a suggestion, where it can be found as typed. */
function Highlighted({ text, typed }: { text: string; typed: string }) {
  const at = typed ? text.toLowerCase().indexOf(typed.toLowerCase()) : -1
  if (at < 0) return <span className="font-semibold">{text}</span>
  return (
    <span className="text-[var(--home-muted)]">
      {text.slice(0, at)}
      <span className="font-semibold text-[var(--home-heading)]">{text.slice(at, at + typed.length)}</span>
      {text.slice(at + typed.length)}
    </span>
  )
}

/**
 * What to search for, offered while someone types, as on TikTok: reciters whose name is close to
 * it, then searches (recitation titles and #tags), close matches included. Tapping a search runs
 * it; the arrow at the end puts it in the box to carry on typing.
 */
export default function SearchSuggestions({
  typed,
  viewerId,
  onPick,
  onFill,
  className,
}: {
  typed: string
  viewerId: string | null
  onPick: (term: string) => void
  onFill: (term: string) => void
  className?: string
}) {
  const t = useT()
  const [suggestions, setSuggestions] = useState<QariSuggestions | null>(null)
  const query = typed.trim()

  useEffect(() => {
    if (!query) {
      setSuggestions(null)
      return
    }
    const controller = new AbortController()
    // A moment after the typing pauses, not on every key.
    const timer = window.setTimeout(() => {
      fetchSuggestions(query, viewerId, controller.signal)
        .then(setSuggestions)
        .catch(() => {})
    }, 160)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, viewerId])

  if (!query) return null

  // What was typed comes first, as a search of its own, unless a suggestion already says it.
  const terms = suggestions?.terms ?? []
  const typedFirst = terms.some((term) => normalizeText(term) === normalizeText(query)) ? terms : [query, ...terms]

  return (
    <div className={cn('qari-enter', className)} role="listbox" aria-label={t('Suggestions')}>
      {suggestions?.qaris.length ? (
        <ul className="pb-1">
          {suggestions.qaris.map((qari) => (
            <li key={qari.username}>
              <Link
                href={`/qari/${encodeURIComponent(qari.username)}`}
                onClick={tapFeedback}
                className="ed-focus flex items-center gap-3 rounded-xl py-2"
              >
                <QariAvatar username={qari.username} name={qari.name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[var(--home-heading)]">{qari.name}</span>
                  <span className="block truncate text-[13px] text-[var(--home-muted)]">@{qari.username}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <ul>
        {typedFirst.map((term) => (
          <li key={term} className="flex items-center">
            <button
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => {
                tapFeedback()
                onPick(term)
              }}
              className="ed-focus flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 text-left"
            >
              <Search className="h-[18px] w-[18px] shrink-0 text-[var(--home-muted)]" strokeWidth={2.1} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--home-heading)]">
                <Highlighted text={term} typed={query} />
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                onFill(term)
              }}
              aria-label={t('Put “{term}” in the search box', { term })}
              className="ed-focus -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)]"
            >
              <ArrowUpLeft className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
