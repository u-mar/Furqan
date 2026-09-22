'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Mic } from 'lucide-react'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { askToSignIn } from '@/lib/account-prompt'
import { getSignedInUser } from '@/lib/auth'
import { tapFeedback } from '@/lib/haptics'
import { useT } from '@/lib/i18n'

/**
 * The one way to start a new recitation from anywhere in Qari, now that the
 * main bottom bar replaced Qari's own Feed/Record/You bar. Floats above the
 * main bar, aligned with the same centered column. Hidden on the record
 * screen itself — that screen is a single task with its own way out.
 */
export default function QariRecordFab() {
  const t = useT()
  const pathname = usePathname()
  const router = useRouter()
  // A playing recitation can dock its mini player just above the main bar —
  // clear of it, rather than sitting underneath.
  const hasActivePlayer = Boolean(useQariPlayer().current)

  if (pathname === '/qari/record') return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{
        bottom: hasActivePlayer
          ? `calc(${BOTTOM_NAV_HEIGHT_REM}rem + 5.5rem + env(safe-area-inset-bottom))`
          : `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1rem)`,
      }}
    >
      <div className="flex w-full max-w-lg justify-end px-4">
        <Link
          href="/qari/record"
          onClick={(e) => {
            tapFeedback()
            // Recording is the first thing that needs an account, so this is where it is asked for.
            if (!getSignedInUser()) {
              e.preventDefault()
              askToSignIn({
                reason: t('Create a free account to record and share your recitation.'),
                onDone: () => router.push('/qari/record'),
              })
            }
          }}
          className="qari-record-fab ed-focus pointer-events-auto flex items-center gap-2 rounded-full"
        >
          <Mic className="h-[17px] w-[17px]" strokeWidth={2.2} />
          {t('Record')}
        </Link>
      </div>
    </div>
  )
}
