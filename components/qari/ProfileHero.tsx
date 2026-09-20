'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, Pencil, Share2 } from 'lucide-react'
import QariAvatar from '@/components/qari/QariAvatar'
import { SheikhMonogram } from '@/components/qari/SheikhCards'
import { tapFeedback } from '@/lib/haptics'
import { compactNumber } from '@/lib/qari'
import { findSheikh } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

/**
 * The bar across the top of a profile. It is plain over the banner and, once
 * the banner has scrolled away, settles into a bar that carries the name.
 */
export function ProfileTopBar({
  username,
  name,
  avatarVersion,
  onShare,
}: {
  username: string
  name: string
  avatarVersion?: number
  onShare: () => void
}) {
  const t = useT()
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 190)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 -mx-4 -mt-[max(1rem,env(safe-area-inset-top))] flex items-center gap-3 px-4 pb-2.5 pt-[max(1rem,env(safe-area-inset-top))] transition-[background-color,box-shadow,backdrop-filter] duration-200',
        condensed && 'bg-[color-mix(in_srgb,var(--app-bg)_88%,transparent)] shadow-[0_1px_0_var(--home-rule)] backdrop-blur-md'
      )}
    >
      <Link href="/qari" className="home-round ed-focus" aria-label={t('Back')}>
        <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
      </Link>
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 transition-all duration-200',
          condensed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'
        )}
        aria-hidden={!condensed}
      >
        <QariAvatar username={username} name={name} size={28} version={avatarVersion} />
        <span className="home-serif truncate text-[1.0625rem] font-semibold text-[var(--home-heading)]">{name}</span>
      </div>
      <button type="button" onClick={onShare} className="home-round ed-focus ml-auto" aria-label={t('Share profile')}>
        <Share2 className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </button>
    </header>
  )
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="min-w-[4.25rem] text-center">
      <div className="flex h-6 items-center justify-center text-[1.1875rem] font-bold tabular-nums text-[var(--home-heading)]">
        {value === null ? <span className="qari-skeleton block h-4 w-7 rounded-md" /> : compactNumber(value)}
      </div>
      <p className="mt-0.5 text-[12.5px] text-[var(--home-muted)]">{label}</p>
    </div>
  )
}

/**
 * Who this qari is, the way a short-video profile shows it: the picture,
 * @handle and name, three numbers, one clear button, and the sheikhs they imitate.
 */
export default function ProfileHero({
  username,
  name,
  isMe,
  avatarVersion,
  stats,
  sheikhIds,
  actions,
  onShare,
  onEditPicture,
}: {
  username: string
  name: string
  isMe: boolean
  avatarVersion?: number
  stats: { followers: number | null; plays: number | null; loved: number | null }
  sheikhIds: string[]
  /** The Follow or Edit profile button. */
  actions: React.ReactNode
  onShare: () => void
  onEditPicture: () => void
}) {
  const t = useT()
  const sheikhs = sheikhIds.map((id) => findSheikh(id)).filter((s): s is NonNullable<typeof s> => Boolean(s))

  return (
    <section className="qari-enter flex flex-col items-center text-center">
      <div className="relative">
        <QariAvatar username={username} name={name} size={104} version={avatarVersion} />
        {isMe ? (
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              onEditPicture()
            }}
            aria-label={t('Edit profile picture')}
            className="qari-press ed-focus ed-ink absolute -right-0.5 bottom-0 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-[var(--app-bg)]"
          >
            <Pencil className="h-[13px] w-[13px]" strokeWidth={2.4} />
          </button>
        ) : null}
      </div>

      <h1 className="mt-3 max-w-full truncate text-[1.0625rem] font-bold text-[var(--home-heading)]">@{username}</h1>
      {name.toLowerCase() !== username.toLowerCase() ? (
        <p className="max-w-full truncate text-[13.5px] text-[var(--home-muted)]">{name}</p>
      ) : null}

      <div className="mt-4 flex items-start justify-center gap-3">
        <Stat value={stats.followers} label={t('Followers')} />
        <Stat value={stats.plays} label={t('Plays')} />
        <Stat value={stats.loved} label={t('Loved')} />
      </div>

      <div className="mt-4 flex w-full max-w-[19rem] items-center gap-2">
        <div className="flex min-w-0 flex-1">{actions}</div>
        <button
          type="button"
          onClick={onShare}
          aria-label={t('Share profile')}
          className="qari-press ed-focus flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--home-rule-strong)] text-[var(--home-heading)]"
        >
          <Share2 className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>

      {sheikhs.length > 0 ? (
        <div className="qari-no-scrollbar -mx-4 mt-4 flex max-w-[calc(100%+2rem)] justify-start gap-2 overflow-x-auto px-4 sm:justify-center">
          {sheikhs.map((sheikh) => (
            <Link
              key={sheikh.id}
              href={`/qari/sheikh/${sheikh.id}`}
              onClick={tapFeedback}
              className="qari-press ed-focus flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--home-heading)_6%,transparent)] py-0.5 pl-0.5 pr-3 text-[12.5px] font-semibold text-[var(--home-heading)]"
            >
              <SheikhMonogram sheikh={sheikh} size={26} />
              {sheikh.shortName}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
