'use client'

import { Volume1, Volume2 } from 'lucide-react'
import { useNature } from '@/components/listen/NatureControls'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useListenVolume } from '@/hooks/useListenVolume'
import { setListenVolume } from '@/lib/listen-player'
import { natureName, setNatureVolume } from '@/lib/nature-sounds'
import { useT } from '@/lib/i18n'

/** The two volumes of Listen, the recitation and Nature mode's sounds, each with its own slider (both players). */
export default function VolumeSheet({ open, reciterName, onClose }: { open: boolean; reciterName: string; onClose: () => void }) {
  const t = useT()
  const listenVolume = useListenVolume()
  const nature = useNature()
  return (
    <SettingsSheet open={open} title={t('Volume')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <VolumeRow label={t('Recitation')} note={reciterName} value={listenVolume} onChange={setListenVolume} />
        <VolumeRow
          label={t('Nature mode')}
          note={nature.sounds.length ? nature.sounds.map(natureName).join(' · ') : t('Off')}
          value={nature.volume}
          onChange={setNatureVolume}
        />
      </div>
    </SettingsSheet>
  )
}

/** One labelled volume slider: a name, what it is now, and the slider. */
function VolumeRow({
  label,
  note,
  value,
  onChange,
}: {
  label: string
  note: string
  value: number
  onChange: (value: number) => void
}) {
  const percent = Math.round(value * 100)
  return (
    <div className="sleep-status flex-col !items-stretch !gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.9375rem] font-semibold text-[var(--home-heading)]">{label}</span>
        <span className="min-w-0 truncate text-[0.78125rem] text-[var(--home-muted)]">{note}</span>
      </div>
      {/* Left to right in Arabic too: the slider's fill is drawn from the left. */}
      <div dir="ltr" className="flex items-center gap-3">
        <Volume1 className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={1.9} aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label={label}
          className="listen-seek min-w-0 flex-1"
          style={{ ['--fill' as string]: `${percent}%` }}
        />
        <Volume2 className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={1.9} aria-hidden />
      </div>
    </div>
  )
}
