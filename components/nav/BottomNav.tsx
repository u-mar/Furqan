'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BookOpen, Headphones, House, Mic, UserRound, type LucideIcon } from 'lucide-react'
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications'
import { useViewer } from '@/hooks/useViewer'
import { askToSignIn } from '@/lib/account-prompt'
import { BOTTOM_NAV_HEIGHT_REM, showBottomNavFor } from '@/lib/bottom-nav'
import { tapFeedback } from '@/lib/haptics'
import { LAST_READ_PAGE_KEY } from '@/lib/mushaf'
import { notePath } from '@/lib/nav-trail'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

interface Tab {
  id: string
  /** Null for Profile when signed out: the tab asks you to sign in instead. */
  href: string | null
  label: string
  icon: LucideIcon
  active: boolean
  dot?: boolean
  ariaLabel?: string
}

/** The middle of the bar, a dip that cradles the Home button: its top edge, then filled black below. */
const NOTCH_EDGE = 'M0,0.5 H12 Q18,0.5 20,4.5 A32,32 0 0 0 84,4.5 Q86,0.5 92,0.5 H104'
const NOTCH_FILL = 'M0,0 H12 Q18,0 20,4 A32,32 0 0 0 84,4 Q86,0 92,0 H104 V56 H0 Z'

/**
 * Quran, Listen, Home, Qari and Profile, on a black bar flush with the bottom
 * edge, as on TikTok. Home sits in the middle in a round button, set into a dip
 * in the bar. Grey line icons with their names, the tab you are on white.
 * Profile is your Qari profile, with a dot when you have new notifications;
 * signed out, it asks you to sign in. Shown on Home, Listen, every Qari screen
 * except the recorder, both Prayer screens, Halaqa and Hifdh; the mushaf is its
 * own deeper screen and hides it to keep the whole screen for reading.
 */
export default function BottomNav() {
  const t = useT()
  const pathname = usePathname()
  const viewer = useViewer()
  const unread = useUnreadNotifications(viewer)
  const [lastPage, setLastPage] = useState(1)

  // Looked up again on every screen change: the bar outlives Read, and Read
  // must open where it was last left, not where it was when the app opened.
  useEffect(() => {
    notePath(pathname)
    const page = Math.min(604, Math.max(1, Number(localStorage.getItem(LAST_READ_PAGE_KEY) || '1') || 1))
    setLastPage(page)
  }, [pathname])

  if (!showBottomNavFor(pathname)) return null

  const profileHref = viewer ? `/qari/${encodeURIComponent(viewer.username)}` : null
  const onProfile = Boolean(profileHref && decodeURIComponent(pathname).toLowerCase() === `/qari/${viewer!.username.toLowerCase()}`)
  const homeActive = pathname === '/'

  const left: Tab[] = [
    { id: 'quran', href: `/read?page=${lastPage}`, label: t('Quran'), icon: BookOpen, active: false },
    { id: 'listen', href: '/listen', label: t('Listen'), icon: Headphones, active: pathname === '/listen' },
  ]
  const right: Tab[] = [
    { id: 'qari', href: '/qari', label: t('Qari'), icon: Mic, active: pathname.startsWith('/qari') && !onProfile },
    {
      id: 'profile',
      href: profileHref,
      label: t('Profile'),
      icon: UserRound,
      active: onProfile,
      dot: unread > 0,
      ariaLabel: unread > 0 ? t('Your profile, {count} new notifications', { count: unread }) : undefined,
    },
  ]

  const item = (tab: Tab) => {
    const inside = (
      <>
        <span className="relative">
          <tab.icon className="bottom-nav__icon" strokeWidth={tab.active ? 2.2 : 1.8} aria-hidden />
          {tab.dot ? <span className="bottom-nav__badge" aria-hidden /> : null}
        </span>
        <span className="bottom-nav__label">{tab.label}</span>
      </>
    )
    return tab.href ? (
      <Link
        key={tab.id}
        href={tab.href}
        onClick={() => tapFeedback()}
        aria-current={tab.active ? 'page' : undefined}
        aria-label={tab.ariaLabel}
        className="bottom-nav__item ed-focus"
      >
        {inside}
      </Link>
    ) : (
      <button
        key={tab.id}
        type="button"
        onClick={() => {
          tapFeedback()
          askToSignIn()
        }}
        className="bottom-nav__item ed-focus"
      >
        {inside}
      </button>
    )
  }

  return (
    <nav
      aria-label={t('Main navigation')}
      className="bottom-nav fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* The bar itself: black either side, and a dip in the middle that the Home button sits in. */}
      <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
        <div className="bottom-nav__side flex-1" />
        <div className="flex w-[104px] flex-col">
          <svg viewBox="0 0 104 56" className="block h-14 w-[104px] shrink-0">
            <path d={NOTCH_FILL} fill="#000000" />
            <path d={NOTCH_EDGE} fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
          </svg>
          <div className="flex-1 bg-black" />
        </div>
        <div className="bottom-nav__side flex-1" />
      </div>

      <div className="relative mx-auto flex w-full max-w-lg items-stretch justify-between" style={{ height: `${BOTTOM_NAV_HEIGHT_REM}rem` }}>
        {left.map(item)}
        <Link
          href="/"
          onClick={() => tapFeedback()}
          aria-current={homeActive ? 'page' : undefined}
          className="bottom-nav__item bottom-nav__home ed-focus"
        >
          <span className={cn('bottom-nav__home-circle', homeActive && 'is-active')}>
            <House className="h-[1.375rem] w-[1.375rem]" strokeWidth={homeActive ? 2.3 : 1.9} aria-hidden />
          </span>
          {/* Holds the icon's place, so the name lines up with the other tabs' names, under the button. */}
          <span className="bottom-nav__icon" aria-hidden />
          <span className="bottom-nav__label">{t('Home')}</span>
        </Link>
        {right.map(item)}
      </div>
    </nav>
  )
}
