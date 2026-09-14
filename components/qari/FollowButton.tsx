'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { tapFeedback } from '@/lib/haptics'
import { setFollowing } from '@/lib/qari'
import type { AppUser } from '@/lib/auth'
import { cn } from '@/lib/cn'

/** Follow / Following. Changes the moment it is tapped and settles when the server answers. */
export default function FollowButton({
  viewer,
  target,
  following,
  onChange,
  onNotice,
  size = 'sm',
}: {
  viewer: AppUser | null
  target: string
  following: boolean
  onChange?: (state: { following: boolean; followers: number | null }) => void
  onNotice?: (message: string) => void
  size?: 'sm' | 'lg'
}) {
  const [on, setOn] = useState(following)
  const [busy, setBusy] = useState(false)

  useEffect(() => setOn(following), [following])

  const toggle = useCallback(async () => {
    if (!viewer) {
      onNotice?.('Sign in to follow qaris.')
      return
    }
    tapFeedback()
    const next = !on
    setOn(next)
    onChange?.({ following: next, followers: null })
    setBusy(true)
    try {
      const result = await setFollowing(viewer, target, next)
      setOn(result.following)
      onChange?.(result)
    } catch (err) {
      setOn(!next)
      onChange?.({ following: !next, followers: null })
      onNotice?.(err instanceof Error ? err.message : 'Could not update that.')
    } finally {
      setBusy(false)
    }
  }, [on, onChange, onNotice, target, viewer])

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={on}
      className={cn(
        'qari-press ed-focus flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors',
        size === 'lg' ? 'h-11 flex-1 text-sm' : 'h-[34px] px-4 text-[13px]',
        on
          ? 'border border-[var(--home-card-border)] bg-[var(--home-card-bg)] text-[var(--home-heading)]'
          : 'ed-ink font-bold'
      )}
    >
      {on ? <Check className="h-3.5 w-3.5 text-[var(--home-sage)]" strokeWidth={2.8} /> : null}
      {on ? 'Following' : 'Follow'}
    </button>
  )
}
