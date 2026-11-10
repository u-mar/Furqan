'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  Bird,
  ChevronRight,
  CloudLightning,
  CloudRain,
  Flame,
  House,
  Leaf,
  Moon,
  MoonStar,
  Mountain,
  Pause,
  Play,
  Trees,
  Volume1,
  Volume2,
  Waves,
  Wind,
  X,
  type LucideIcon,
} from 'lucide-react'
import { SleepLeft } from '@/components/listen/SleepControls'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useListenState } from '@/hooks/useListen'
import { BOTTOM_NAV_HEIGHT_REM, BOTTOM_NAV_RAISE_REM } from '@/lib/bottom-nav'
import { tapFeedback } from '@/lib/haptics'
import {
  NATURE_SOUNDS,
  getNatureState,
  getServerNatureState,
  natureName,
  setNatureVolume,
  stopNature,
  subscribeNature,
  toggleNature,
  toggleNatureSound,
  type NatureId,
} from '@/lib/nature-sounds'
import { useT } from '@/lib/i18n'

const ICONS: Record<NatureId, LucideIcon> = {
  rain: CloudRain,
  thunderstorm: CloudLightning,
  roof: House,
  waves: Waves,
  birds: Bird,
  stream: Mountain,
  forest: Trees,
  wind: Wind,
  night: MoonStar,
  fire: Flame,
}

export function useNature() {
  return useSyncExternalStore(subscribeNature, getNatureState, getServerNatureState)
}

/** The moon at the top of Listen: plain while quiet, the sound playing (and any sleep time) once on. */
export function NatureButton({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const { sounds, playing } = useNature()
  const { sleep } = useListenState()
  const open = () => {
    tapFeedback()
    onOpen()
  }

  if (playing && sounds.length) {
    const Icon = ICONS[sounds[sounds.length - 1]]
    return (
      <button
        type="button"
        onClick={open}
        aria-label={t('Nature mode is on')}
        className="fx-pop-in fx-press ed-focus flex h-[42px] min-w-0 shrink-0 items-center gap-[7px] rounded-full bg-[var(--home-card-bg)] pl-3 pr-3.5 text-[0.84375rem] font-semibold tabular-nums text-[var(--home-sage-deep)] shadow-[var(--home-lift-sm)]"
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--home-sage)]" strokeWidth={2} />
        <span className="max-w-[7.5rem] truncate">
          {natureName(sounds[sounds.length - 1])}
          {sounds.length > 1 ? ` +${sounds.length - 1}` : ''}
        </span>
        {sleep ? (
          <span className="font-medium text-[var(--home-muted)]">
            · <SleepLeft fallback={t('On')} />
          </span>
        ) : null}
      </button>
    )
  }

  if (sleep) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={t('Sleep mode is on')}
        className="fx-pop-in fx-press ed-focus flex h-[42px] shrink-0 items-center gap-[7px] rounded-full bg-[var(--home-card-bg)] pl-3 pr-3.5 text-[0.84375rem] font-semibold tabular-nums text-[var(--home-sage-deep)] shadow-[var(--home-lift-sm)]"
      >
        <Moon className="h-4 w-4 fill-current text-[var(--home-sage)]" strokeWidth={1.9} />
        <SleepLeft fallback={t('On')} />
      </button>
    )
  }

  return (
    <button type="button" onClick={open} className="home-round ed-focus" aria-label={t('Nature mode')}>
      <Moon className="h-[19px] w-[19px]" strokeWidth={1.9} />
    </button>
  )
}

/**
 * Nature mode in the middle of Now playing's header: a leaf and its name while
 * quiet, the sound playing (and how many more) once one is on.
 */
export function NatureChip({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const { sounds, playing } = useNature()
  const live = playing && sounds.length > 0
  const latest = sounds[sounds.length - 1]
  const Icon = live && latest ? ICONS[latest] : Leaf
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onOpen()
      }}
      aria-label={live ? t('Nature mode is on') : t('Nature mode')}
      className="fx-press ed-focus flex h-[42px] min-w-0 max-w-[11rem] items-center gap-2 rounded-full bg-[var(--home-card-bg)] px-3.5 text-[0.84375rem] font-semibold shadow-[var(--home-lift-sm)]"
    >
      <Icon className={`h-4 w-4 shrink-0 ${live ? 'text-[var(--home-sage)]' : 'text-[var(--home-heading)]'}`} strokeWidth={2} aria-hidden />
      <span className={`truncate ${live ? 'text-[var(--home-sage-dark)]' : 'text-[var(--home-heading)]'}`}>
        {live && latest ? `${natureName(latest)}${sounds.length > 1 ? ` +${sounds.length - 1}` : ''}` : t('Nature mode')}
      </span>
    </button>
  )
}

/** Choose the sounds (up to three at once), set how loud, and reach the sleep timer. */
export function NatureSheet({ open, onClose, onOpenSleep }: { open: boolean; onClose: () => void; onOpenSleep: () => void }) {
  const t = useT()
  const { sounds, playing, volume } = useNature()
  const { sleep } = useListenState()
  const percent = Math.round(volume * 100)

  return (
    <SettingsSheet
      open={open}
      title={t('Nature mode')}
      description={t('Sounds of nature, on their own or under the recitation.')}
      onClose={onClose}
    >
      <div className="grid grid-cols-5 gap-x-1 gap-y-3.5">
        {NATURE_SOUNDS.map((sound) => {
          const Icon = ICONS[sound.id]
          const on = sounds.includes(sound.id)
          return (
            <button
              key={sound.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                tapFeedback()
                toggleNatureSound(sound.id)
              }}
              className="nature-tile ed-focus"
            >
              <span className="nature-tile__dot" aria-hidden>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
                {on && playing ? <span className="nature-tile__live" /> : null}
              </span>
              <span className="nature-tile__label">{natureName(sound.id)}</span>
            </button>
          )
        })}
      </div>

      {sounds.length ? (
        // Left to right in Arabic too: the slider's fill is drawn from the left.
        <div dir="ltr" className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--home-rule)] py-2 pl-2 pr-3.5">
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              toggleNature()
            }}
            aria-label={playing ? t('Pause') : t('Play')}
            className="ed-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--home-heading)] text-[var(--app-bg)]"
          >
            {playing ? (
              <Pause className="h-[17px] w-[17px] fill-current" strokeWidth={1.9} />
            ) : (
              <Play className="ml-0.5 h-[17px] w-[17px] fill-current" strokeWidth={1.9} />
            )}
          </button>
          <Volume1 className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={1.9} aria-hidden />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(e) => setNatureVolume(Number(e.target.value) / 100)}
            aria-label={t('Volume')}
            className="listen-seek min-w-0 flex-1"
            style={{ ['--fill' as string]: `${percent}%` }}
          />
          <Volume2 className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={1.9} aria-hidden />
        </div>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--home-rule)]">
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            onOpenSleep()
          }}
          className="set-row"
          style={{ paddingBlock: 9 }}
        >
          <span className="set-row__icon" aria-hidden>
            <Moon className="h-[17px] w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block text-[0.9375rem] font-medium">{t('Sleep mode')}</span>
            <span className="mt-px block text-[0.78125rem] tabular-nums text-[var(--home-muted)]">
              {sleep ? <SleepLeft prefix={t('Stops in ')} fallback={t('Stops at the end of this surah')} /> : t('Off')}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--home-muted)] rtl:rotate-180" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <p className="mx-1 mt-2.5 text-[0.78125rem] leading-relaxed text-[var(--home-muted)]">
        {t('Mix up to three sounds. Sleep mode stops them with the recitation.')}</p>
    </SettingsSheet>
  )
}

/** Docked just above the bottom tab bar, where Listen's own player sits. */
const DOCK_BOTTOM = `calc(${BOTTOM_NAV_HEIGHT_REM + BOTTOM_NAV_RAISE_REM}rem + env(safe-area-inset-bottom) + 0.5rem)`

/**
 * Listen's player for the nature sounds once they have started, so they can be
 * paused or stopped. Tapping it opens Nature mode.
 */
export function NatureDock({ onOpen }: { onOpen: () => void }) {
  const t = useT()
  const { sounds, playing, live } = useNature()
  const { sleep } = useListenState()
  const showing = live && sounds.length > 0

  // Listen leaves room for it, and messages sit above it.
  useEffect(() => {
    if (!showing) return
    const root = document.documentElement.style
    root.setProperty('--listen-dock', '4.75rem')
    root.setProperty('--toast-lift', '9.5rem')
    return () => {
      root.removeProperty('--listen-dock')
      root.removeProperty('--toast-lift')
    }
  }, [showing])

  if (!showing) return null
  const Icon = ICONS[sounds[sounds.length - 1]]

  return (
    <div className="listen-mini fixed inset-x-0 z-40 px-3" style={{ bottom: DOCK_BOTTOM }}>
      <div className="listen-float mx-auto flex max-w-lg items-center gap-1.5 rounded-[20px] py-2 pl-2.5 pr-2">
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            onOpen()
          }}
          aria-label={t('Open Nature mode')}
          className="ed-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left"
        >
          <span className="nature-dock__icon" aria-hidden>
            <Icon className="h-5 w-5" strokeWidth={1.8} />
            {playing ? <span className="nature-tile__live" /> : null}
          </span>
          <span className="min-w-0 flex-1 pr-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-[var(--home-heading)]">
              {sounds.map(natureName).join(' · ')}
            </span>
            <span className="block truncate text-[0.78125rem] tabular-nums text-[var(--home-muted)]">
              {sleep ? <SleepLeft prefix={t('Stops in ')} fallback={t('Stops at the end of this surah')} /> : t('Nature mode')}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            toggleNature()
          }}
          aria-label={playing ? t('Pause') : t('Play')}
          className="ed-ink ed-focus fx-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          {playing ? (
            <Pause className="h-4 w-4 fill-current" strokeWidth={0} />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            tapFeedback()
            stopNature()
          }}
          aria-label={t('Stop nature sounds')}
          className="ed-focus fx-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)]"
        >
          <X className="h-[19px] w-[19px]" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
