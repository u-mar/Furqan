'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { Mic } from 'lucide-react'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { askToSignIn } from '@/lib/account-prompt'
import { getSignedInUser } from '@/lib/auth'
import { tapFeedback } from '@/lib/haptics'
import { useT } from '@/lib/i18n'

/**
 * The click handler for any button that starts a recording. Recording is the
 * first thing that needs an account, so this is where it is asked for.
 */
export function useStartRecording() {
  const t = useT()
  const router = useRouter()
  return (e: React.MouseEvent) => {
    tapFeedback()
    if (!getSignedInUser()) {
      e.preventDefault()
      askToSignIn({
        reason: t('Create a free account to record and share your recitation.'),
        onDone: () => router.push('/qari/record'),
      })
    }
  }
}

/**
 * The one way to start a new recitation from anywhere in Qari, now that the
 * main bottom bar replaced Qari's own Feed/Record/You bar. Floats above the
 * main bar, aligned with the same centered column. Hidden on the record
 * screen itself — that screen is a single task with its own way out.
 */
export default function QariRecordFab() {
  const t = useT()
  const pathname = usePathname()
  const startRecording = useStartRecording()
  // A playing recitation can dock its mini player just above the main bar —
  // clear of it, rather than sitting underneath.
  const hasActivePlayer = Boolean(useQariPlayer().current)
  const [hidden, setHidden] = useState(false)

  // Out of the way while scrolling down the list, back as soon as you scroll up.
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY
      if (Math.abs(delta) < 8) return
      setHidden(delta > 0 && y > 80)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (pathname === '/qari/record') return null

  return (
    <div
      className={cn(
        'qari-record-fab-wrap pointer-events-none fixed inset-x-0 z-40 flex justify-center',
        hidden && 'is-hidden'
      )}
      style={{
        bottom: hasActivePlayer
          ? `calc(${BOTTOM_NAV_HEIGHT_REM}rem + 5.5rem + env(safe-area-inset-bottom))`
          : `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1rem)`,
      }}
    >
      <div className="flex w-full max-w-lg justify-end px-4">
        <Link
          href="/qari/record"
          onClick={startRecording}
          aria-label={t('Record')}
          // Hidden means invisible, so it must not be tabbable or tappable either.
          tabIndex={hidden ? -1 : undefined}
          className={cn('qari-record-fab ed-focus flex items-center rounded-full', hidden ? 'pointer-events-none' : 'pointer-events-auto')}
        >
          <Mic className="h-[22px] w-[22px]" strokeWidth={2} />
        </Link>
      </div>
    </div>
  )
}
