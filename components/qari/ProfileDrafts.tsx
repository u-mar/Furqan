'use client'

import { useRouter } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'
import { FileAudio, Trash2 } from 'lucide-react'
import Waveform from '@/components/qari/Waveform'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { tapFeedback } from '@/lib/haptics'
import { formatDuration, timeAgoLong } from '@/lib/qari'
import { deleteDraft, listDrafts, openDraft, subscribeDrafts, type ShelvedDraft } from '@/lib/qari-drafts'
import { useT } from '@/lib/i18n'

const NONE: ShelvedDraft[] = []
let cachedRaw = ''
let cachedList: ShelvedDraft[] = NONE

/** The shelf as it stands; the same array until it changes, as a store's snapshot must be. */
function snapshot(): ShelvedDraft[] {
  const list = listDrafts()
  const raw = JSON.stringify(list)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = list
  }
  return cachedList
}

/** The recitations saved for later on this phone. */
export function useDrafts(): ShelvedDraft[] {
  return useSyncExternalStore(subscribeDrafts, snapshot, () => NONE)
}

/**
 * The first tile of your own grid, as on TikTok: "Drafts" and how many. They are kept on this
 * phone only, so nobody else ever sees the tile.
 */
export function DraftsTile({ count, onOpen }: { count: number; onOpen: () => void }) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onOpen()
      }}
      className="qari-press ed-focus relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden bg-[color-mix(in_srgb,var(--home-heading)_9%,transparent)] text-[var(--home-heading)]"
    >
      <FileAudio className="h-7 w-7 opacity-80" strokeWidth={1.7} aria-hidden />
      <span className="text-[13px] font-semibold">
        {t('Drafts')} · {count}
      </span>
    </button>
  )
}

/** Every draft, newest first: tap one to finish it on the record screen, or delete it. */
export function DraftsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const router = useRouter()
  const drafts = useDrafts()
  const [armed, setArmed] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const finish = async (id: string) => {
    if (opening) return
    tapFeedback()
    setOpening(id)
    const ok = await openDraft(id)
    setOpening(null)
    if (ok) router.push('/qari/record?draft=1')
  }

  return (
    <SettingsSheet open={open} title={t('Drafts')} description={t('Kept on this phone only. Tap one to finish and post it.')} onClose={onClose}>
      {drafts.length === 0 ? (
        <p className="py-6 text-center text-[0.9375rem] text-[var(--home-muted)]">{t('No drafts.')}</p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((draft) => (
            <li key={draft.id} className="flex items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--home-heading)_6%,transparent)] py-2 pl-3.5 pr-2">
              <button type="button" onClick={() => void finish(draft.id)} disabled={opening !== null} className="ed-focus min-w-0 flex-1 rounded-xl text-left">
                <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">{draft.title.trim() || t('Untitled recitation')}</span>
                <span className="mt-0.5 flex items-center gap-2 text-[0.78125rem] tabular-nums text-[var(--home-muted)]">
                  <Waveform peaks={draft.peaks} seed={draft.id} progress={0} bars={18} tone="dark" className="h-4 w-16 shrink-0" />
                  {formatDuration(draft.durationSec)} · {timeAgoLong(new Date(draft.savedAt).toISOString())}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  if (armed !== draft.id) return setArmed(draft.id)
                  setArmed(null)
                  void deleteDraft(draft.id)
                }}
                aria-label={armed === draft.id ? t('Tap again to delete') : t('Delete draft')}
                className={`ed-focus flex h-10 shrink-0 items-center justify-center rounded-full px-3 text-[0.78125rem] font-semibold ${armed === draft.id ? 'bg-rose-600 text-white' : 'text-[var(--home-muted)]'}`}
              >
                {armed === draft.id ? t('Delete?') : <Trash2 className="h-[17px] w-[17px]" strokeWidth={2} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsSheet>
  )
}
