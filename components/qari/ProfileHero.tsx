'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronLeft, Pencil, Share2, UserRoundPlus } from 'lucide-react'
import NotificationsBell from '@/components/qari/NotificationsBell'
import QariAvatar from '@/components/qari/QariAvatar'
import { tapFeedback } from '@/lib/haptics'
import { compactNumber } from '@/lib/qari'
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
  showNotifications = false,
  findPeople = false,
  extra,
}: {
  username: string
  name: string
  avatarVersion?: number
  /** Your own profile carries the bell: notifications no longer have a button on the feed. */
  showNotifications?: boolean
  /**
   * Your own profile: reached from its tab in the bottom bar, so it has no Back, and the way to find
   * other qaris sits top left instead, as on TikTok.
   */
  findPeople?: boolean
  /** More actions at the end of the bar, e.g. blocking someone else's profile. Sharing lives in the hero. */
  extra?: React.ReactNode
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
      {findPeople ? null : (
        <Link href="/qari" className="home-round ed-focus" aria-label={t('Back')}>
          <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
        </Link>
      )}
      {/* The @handle is the page's title, as on Instagram; once the header has scrolled away the picture joins it. */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {condensed ? <QariAvatar username={username} name={name} size={28} version={avatarVersion} /> : null}
        <h1 className="truncate text-[1.25rem] font-bold tracking-[-0.01em] text-[var(--home-heading)]">@{username}</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {findPeople ? (
          <Link href="/qari/qaris" onClick={() => tapFeedback()} className="home-round ed-focus" aria-label={t('Find qaris')}>
            <UserRoundPlus className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </Link>
        ) : null}
        {showNotifications ? <NotificationsBell /> : null}
        {extra}
      </div>
    </header>
  )
}

function Stat({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="flex h-6 items-center justify-center text-[1.1875rem] font-bold tabular-nums text-[var(--home-heading)]">
        {value === null ? <span className="qari-skeleton block h-4 w-7 rounded-md" /> : compactNumber(value)}
      </div>
      <p className="mt-0.5 text-[12.5px] text-[var(--home-muted)]">{label}</p>
    </div>
  )
}

/**
 * Who this qari is, the way a short-video profile shows it: the picture,
 * @handle and name, three numbers, one clear button, and their bio.
 */
export default function ProfileHero({
  username,
  name,
  isMe,
  avatarVersion,
  stats,
  bio = '',
  actions,
  onShare,
  onEditPicture,
}: {
  username: string
  name: string
  isMe: boolean
  avatarVersion?: number
  stats: { followers: number | null; plays: number | null; loved: number | null }
  /** A line they wrote about themselves; nothing shows when it is empty. */
  bio?: string
  /** The Follow or Edit profile button. */
  actions: React.ReactNode
  onShare: () => void
  onEditPicture: () => void
}) {
  const t = useT()

  return (
    <section className="qari-enter">
      {/* The picture on the left with the numbers beside it, so the recitations start higher up. */}
      <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <QariAvatar username={username} name={name} size={84} version={avatarVersion} />
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

        <div className="flex min-w-0 flex-1 items-start">
          <Stat value={stats.followers} label={t('Followers')} />
          <Stat value={stats.plays} label={t('Plays')} />
          <Stat value={stats.loved} label={t('Loved')} />
        </div>
      </div>

      <p className="mt-3 truncate text-[0.9375rem] font-bold text-[var(--home-heading)]">{name}</p>
      {bio ? <p className="mt-0.5 whitespace-pre-line text-[0.84375rem] leading-snug text-[var(--home-heading)]">{bio}</p> : null}

      <div className="mt-3.5 flex items-center gap-2">
        <div className="flex min-w-0 flex-1">{actions}</div>
        <button
          type="button"
          onClick={onShare}
          className="qari-press ed-focus flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--home-heading)_8%,transparent)] text-[14.5px] font-semibold text-[var(--home-heading)]"
        >
          <Share2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          <span className="truncate">{t('Share profile')}</span>
        </button>
      </div>
    </section>
  )
}
