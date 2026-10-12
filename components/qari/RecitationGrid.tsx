'use client'

import { ImageIcon, Lock, Play } from 'lucide-react'
import BackgroundCover from '@/components/qari/BackgroundCover'
import { tapFeedback } from '@/lib/haptics'
import { recitationBackground } from '@/lib/qari-backgrounds'
import { compactNumber, type Recitation } from '@/lib/qari'
import { useT } from '@/lib/i18n'

/**
 * Recitations as videos, three to a row the way a video profile shows them:
 * each on its background, with its title and how often it was played. A tap
 * opens it full screen, to swipe on through the rest from there.
 */
export default function RecitationGrid({ items, onOpen }: { items: Recitation[]; onOpen: (id: string) => void }) {
  const t = useT()
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((r) => {
        const card = r.kind === 'ayah'
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              tapFeedback()
              onOpen(r.id)
            }}
            aria-label={card ? t('Ayah card for {verseKey}', { verseKey: r.verseKey ?? '' }) : r.title}
            className="qari-press ed-focus relative aspect-[9/16] overflow-hidden rounded-xl bg-[#0d1f1c]"
          >
            {card && r.imageUrl ? (
              <img src={r.imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <BackgroundCover background={recitationBackground(r)} small />
            )}
            <span className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/75" aria-hidden />
            {r.isPrivate ? (
              <Lock className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white drop-shadow" strokeWidth={2.2} aria-hidden />
            ) : null}
            <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-1.5 text-left text-white">
              {card ? null : (
                <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                  {r.title}
                </span>
              )}
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-white/85">
                {card ? (
                  <>
                    <ImageIcon className="h-3 w-3" strokeWidth={2.2} aria-hidden />
                    {r.verseKey}
                  </>
                ) : (
                  <>
                    <Play className="h-2.5 w-2.5 fill-current" strokeWidth={0} aria-hidden />
                    {compactNumber(r.playCount)}
                  </>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
