'use client'

import { Check, Loader2, Mic, Square, X } from 'lucide-react'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'

export type RecordButtonState = 'idle' | 'listening' | 'checking' | 'correct' | 'incorrect' | 'unsupported'

/**
 * Floats fixed above the bottom nav, bottom-right of the content column —
 * a glowing green circle, like Tarteel's own recite button. Qari's record
 * screen uses the same `.hifdh-rec` look for its own record/stop button,
 * just positioned inline rather than floating.
 */
export default function RecordButton({
  state,
  onStart,
  onStop,
  leading,
  bottomOffset,
}: {
  state: RecordButtonState
  onStart: () => void
  onStop: () => void
  /** Extra controls in the same floating lane, to the mic's left (e.g. reveal hints). */
  leading?: React.ReactNode
  /** Distance from the screen's bottom edge, as a CSS length. Defaults to
   *  sitting just above the bottom nav — pass an override on a screen (like
   *  a full mushaf reader) that hides the nav and owns the whole screen. */
  bottomOffset?: string
}) {
  const t = useT()
  const disabled = state === 'checking' || state === 'unsupported'

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
      style={{
        bottom: bottomOffset ?? `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 1rem)`,
      }}
    >
      <div className="flex w-full max-w-lg items-center justify-end gap-2 px-4">
        {leading}
        <button
          type="button"
          onClick={() => (state === 'listening' ? onStop() : state === 'idle' ? onStart() : undefined)}
          disabled={disabled}
          aria-label={state === 'listening' ? t('Finish reciting') : t('Start reciting')}
          className={cn(
            'hifdh-rec ed-focus pointer-events-auto',
            state === 'listening' && 'hifdh-rec--listening',
            state === 'correct' && 'hifdh-rec--correct',
            state === 'incorrect' && 'hifdh-rec--incorrect',
            disabled && 'hifdh-rec--disabled'
          )}
        >
          {state === 'checking' ? (
            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.4} />
          ) : state === 'correct' ? (
            <Check className="h-7 w-7" strokeWidth={2.8} />
          ) : state === 'incorrect' ? (
            <X className="h-7 w-7" strokeWidth={2.8} />
          ) : state === 'listening' ? (
            <Square className="h-4 w-4" fill="currentColor" strokeWidth={0} />
          ) : (
            <Mic className="h-7 w-7" strokeWidth={2.2} />
          )}
        </button>
      </div>
    </div>
  )
}
