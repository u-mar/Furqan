'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { tapFeedback } from '@/lib/haptics'
import { useT } from '@/lib/i18n'

export interface GalleryItem {
  id: string
  label: string
  /** null draws a plain black tile. */
  thumb: string | null
  group: string
}

interface BackgroundGalleryProps {
  open: boolean
  items: GalleryItem[]
  /** The order the groups are listed in. */
  groups: string[]
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
}

/**
 * Every picture to choose from, grouped and scrollable, over whatever share
 * sheet opened it. Tapping one chooses it and returns.
 */
export default function BackgroundGallery({ open, items, groups, selectedId, onSelect, onClose }: BackgroundGalleryProps) {
  const t = useT()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !mounted) return null

  const gallery = (
    <div
      role="dialog"
      aria-label={t('Backgrounds')}
      className="fixed inset-0 z-[200] flex flex-col bg-[#0d0f0e] text-white"
    >
      <div className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-base font-semibold">{t('Backgrounds')}</p>
          <p className="text-[11px] text-white/55">{t('{count} pictures', { count: items.length })}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-transform active:scale-90"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-md px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {groups.map((group) => {
            const inGroup = items.filter((item) => item.group === group)
            if (!inGroup.length) return null
            return (
              <section key={group} className="mt-4">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{t(group)}</h2>
                <div className="grid grid-cols-3 gap-2">
                  {inGroup.map((item) => {
                    const selected = item.id === selectedId
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={t(item.label)}
                        onClick={() => {
                          tapFeedback()
                          onSelect(item.id)
                          onClose()
                        }}
                        className={cn(
                          'relative aspect-[4/5] overflow-hidden rounded-xl bg-black transition-transform active:scale-95',
                          selected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0d0f0e]' : 'ring-1 ring-white/12'
                        )}
                      >
                        {item.thumb ? (
                          <img src={item.thumb} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} />
                        ) : null}
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1.5 pt-6 text-left text-[10.5px] font-medium leading-tight">
                          {t(item.label)}
                        </span>
                        {selected ? (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                            <Check className="h-3 w-3" strokeWidth={3.5} />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )

  return createPortal(gallery, document.body)
}
