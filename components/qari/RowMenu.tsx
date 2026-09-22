'use client'

import { useEffect, useRef, useState } from 'react'
import { Ellipsis, Flag, Globe, Lock, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'

/** The quieter actions on a recitation: who can hear it and delete for your own, report for anyone else's. */
export default function RowMenu({
  isOwner,
  isPrivate,
  onTogglePrivacy,
  onReport,
  onDelete,
}: {
  isOwner: boolean
  /** Only meaningful when `isOwner` — whether it's currently visible to everyone or only the reciter. */
  isPrivate?: boolean
  onTogglePrivacy?: () => void
  onReport: () => void
  onDelete: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setConfirming(false)
      return
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('More')}
        aria-expanded={open}
        className="ed-focus flex h-9 w-9 items-center justify-center rounded-full text-[var(--home-muted)] transition-colors hover:text-[var(--home-heading)]"
      >
        <Ellipsis className="h-[18px] w-[18px]" strokeWidth={2} />
      </button>
      {open ? (
        <div className="qari-dropdown__menu bottom-[calc(100%+0.3rem)] right-0 w-[12rem] origin-bottom-right">
          {isOwner ? (
            <>
              {onTogglePrivacy ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    onTogglePrivacy()
                  }}
                  className="qari-dropdown__item ed-focus"
                >
                  {isPrivate ? (
                    <Globe className="h-4 w-4 text-[var(--home-muted)]" strokeWidth={2} />
                  ) : (
                    <Lock className="h-4 w-4 text-[var(--home-muted)]" strokeWidth={2} />
                  )}
                  {isPrivate ? t('Make public') : t('Make private')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (!confirming) {
                    setConfirming(true)
                    return
                  }
                  setOpen(false)
                  onDelete()
                }}
                className="qari-dropdown__item ed-focus text-rose-500"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2} />
                {confirming ? t('Tap again to delete') : t('Delete recitation')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onReport()
              }}
              className="qari-dropdown__item ed-focus"
            >
              <Flag className="h-4 w-4 text-[var(--home-muted)]" strokeWidth={2} />
              {t('Report')}</button>
          )}
        </div>
      ) : null}
    </div>
  )
}
