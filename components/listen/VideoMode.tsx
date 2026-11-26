'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Check, FastForward, Image as ImageIcon, Languages, ListMusic, Loader2, Pause, Play, Rewind, Volume2 } from 'lucide-react'
import BackgroundCover from '@/components/qari/BackgroundCover'
import { NatureChip } from '@/components/listen/NatureControls'
import { SeekBar, SleepTopButton } from '@/components/listen/NowPlayingParts'
import HeartButton from '@/components/listen/HeartButton'
import ReciterAvatar from '@/components/listen/ReciterAvatar'
import VideoAyah from '@/components/listen/VideoAyah'
import VolumeSheet from '@/components/listen/VolumeSheet'
import SettingsSheet from '@/components/settings/SettingsSheet'
import { useAppSettings } from '@/hooks/useAppSettings'
import { setAppSettings } from '@/lib/app-settings'
import { DEFAULT_TRANSLATION_EDITION, TRANSLATION_LANGUAGES, translationLanguageLabel } from '@/lib/translations'
import { useListenState } from '@/hooks/useListen'
import { useListenRate } from '@/hooks/useListenRate'
import { tapFeedback } from '@/lib/haptics'
import { cycleListenRate, seekBy, togglePlay } from '@/lib/listen-player'
import {
  getListenVideoBackground,
  LISTEN_VIDEO_BACKGROUND,
  LISTEN_VIDEO_BACKGROUNDS,
  listenTimeline,
  setListenVideo,
  setListenVideoBackground,
  subscribeListenVideoBackground,
} from '@/lib/listen-video'
import type { VerseTimelineEntry } from '@/lib/qari'
import { getReciterById } from '@/lib/reciters'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useCloseOnBack } from '@/lib/native-back'

/**
 * Translation mode: the whole screen a slow nature clip, graded like the Qari videos, with the ayah
 * being recited and its translation in the middle. Laid out like a music player: the handle and
 * Nature mode at the top (a tap on the handle goes back to Now playing); low on the screen the
 * reciter and surah with the heart, then speed, previous, play, next and sleep, the place in the
 * surah with the time left, and along the bottom the translation's language and the surah list.
 * For a reciter whose recording has no ayah timings, the surah's name stands in the middle.
 *
 * The tab bar hides while it is open (html.listen-video-on), so the clip covers the page and
 * the sheets opened from here (Nature mode, sleep, the language) still come up over it.
 */
/** How far the ⏪ ⏩ buttons move, in seconds. */
const SEEK_SECONDS = 10
/** How long the controls stay up after the last touch while it plays. */
const CONTROLS_STAY_MS = 4000

export default function VideoMode({
  onClose,
  onOpenSleep,
  onOpenNature,
}: {
  /** Closes Now playing, back to the list of surahs. */
  onClose: () => void
  onOpenSleep: () => void
  onOpenNature: () => void
}) {
  const t = useT()
  const { surah, reciterId, status, error } = useListenState()
  const playing = status === 'playing'
  const translationLanguage = useAppSettings().translationLanguage
  const [languageOpen, setLanguageOpen] = useState(false)
  const rate = useListenRate()
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const [volumeOpen, setVolumeOpen] = useState(false)
  const background = useSyncExternalStore(subscribeListenVideoBackground, getListenVideoBackground, () => LISTEN_VIDEO_BACKGROUND)
  // undefined while it loads, null when this recording has none.
  const [timeline, setTimeline] = useState<{ key: string; entries: VerseTimelineEntry[] | null } | undefined>(undefined)
  const timelineKey = surah && reciterId ? `${reciterId}:${surah.id}` : ''

  const exit = () => setListenVideo(false)
  useCloseOnBack(true, exit)

  // While it plays, the controls fade after a few seconds of no touch, leaving the ayah and the scene;
  // a tap on the screen brings them back (and a tap on a control keeps them up a while longer).
  const [shown, setShown] = useState(true)
  const [touchedAt, setTouchedAt] = useState(0)
  useEffect(() => {
    if (!playing || !shown) {
      if (!playing) setShown(true)
      return
    }
    const timer = window.setTimeout(() => setShown(false), CONTROLS_STAY_MS)
    return () => window.clearTimeout(timer)
  }, [playing, shown, touchedAt])
  const onScreenTap = (e: React.MouseEvent) => {
    const onControl = (e.target as HTMLElement).closest('button, input, a')
    if (onControl) {
      setShown(true)
      setTouchedAt(Date.now())
      return
    }
    setShown((now) => !now)
    setTouchedAt(Date.now())
  }

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('listen-video-on')
    const onKey = (e: KeyboardEvent) => {
      // A sheet opened over it closes first.
      if (e.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length <= 2) setListenVideo(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.classList.remove('listen-video-on')
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!surah || !reciterId) return
    let cancelled = false
    void listenTimeline(reciterId, surah.id).then((entries) => {
      if (!cancelled) setTimeline({ key: `${reciterId}:${surah.id}`, entries })
    })
    return () => {
      cancelled = true
    }
  }, [surah, reciterId])

  if (!surah || !reciterId || typeof document === 'undefined') return null
  const reciter = getReciterById(reciterId)
  const entries = timeline?.key === timelineKey ? timeline.entries : undefined

  return createPortal(
    <>
      <div
        className="listen-video fixed inset-0 z-[45] overflow-hidden bg-black text-white"
        onClick={onScreenTap}
        role="dialog"
        aria-modal="true"
        aria-label={t('Translation mode')}
      >
        <BackgroundCover key={background.id} background={background} moving paused={!playing} />
        <div className={cn('qari-mist', !playing && 'is-paused')} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/80" aria-hidden />
        {/* The darker edges of a film frame, as in the Qari videos. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_45%,transparent_55%,rgba(0,0,0,0.5))]" aria-hidden />

        <div className="relative mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
          {/* The handle: a tap goes back to Now playing. */}
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              exit()
            }}
            className="ed-focus mx-auto flex h-7 w-24 items-center justify-center"
            aria-label={t('Turn off translation mode')}
          >
            <span className="h-1 w-10 rounded-full bg-white/50" aria-hidden />
          </button>
          <div className="mt-2 flex justify-center">
            <NatureChip onOpen={onOpenNature} />
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-1">
            {entries ? (
              <VideoAyah timeline={entries} paused={!playing} />
            ) : entries === null ? (
              <div className="text-center">
                <h2
                  className="home-serif text-[2.125rem] font-semibold leading-tight tracking-[-0.02em]"
                  style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}
                >
                  {surah.englishName}
                </h2>
                <p className="amiri !text-center mt-1 text-[1.5rem] leading-normal text-white/90" lang="ar">
                  {surah.name}
                </p>
              </div>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-white/70" strokeWidth={2} aria-hidden />
            )}
          </div>

          {error ? (
            <p className="mb-3 text-center text-sm font-medium text-rose-300" role="alert">
              {error}
            </p>
          ) : null}

          {/* Who and what: the reciter, the surah, and the heart. */}
          <div className="flex min-w-0 items-center gap-3.5">
            <ReciterAvatar reciter={reciter} size={60} className="ring-2 ring-white/70" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.375rem] font-semibold leading-tight" style={{ textShadow: '0 1px 10px rgba(0,0,0,0.45)' }}>
                {surah.englishName}
              </p>
              <p className="mt-0.5 truncate text-[1rem] text-white/75">{reciter.name}</p>
            </div>
            <HeartButton reciter={reciter} size={44} iconSize={21} className="listen-video__heart" />
          </div>

          {/* Speed, 10 s back, play, 10 s on, sleep: these fold away while it plays (the reciter above
              slides down into their place) and come back with a tap on the screen. The place in the
              surah and the buttons below stay. */}
          <div className={cn('listen-video__controls', !shown && 'is-hidden')} aria-hidden={!shown}>
            <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-5 items-center pt-6">
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                cycleListenRate()
              }}
              className="ed-focus justify-self-start text-[0.9375rem] font-semibold tabular-nums text-white/85"
              aria-label={t('Playback speed')}
            >
              {`${rate}×`}
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                seekBy(-SEEK_SECONDS)
              }}
              className="listen-video__button ed-focus justify-self-center"
              aria-label={t('Back {seconds} seconds', { seconds: SEEK_SECONDS })}
            >
              <Rewind className="h-8 w-8 fill-current rtl:-scale-x-100" strokeWidth={0} />
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                togglePlay()
              }}
              className="listen-video__button ed-focus h-16 w-16 justify-self-center"
              aria-label={playing || status === 'loading' ? t('Pause') : t('Play')}
            >
              {status === 'loading' ? (
                <Loader2 className="h-9 w-9 animate-spin" strokeWidth={2} />
              ) : playing ? (
                <Pause className="h-11 w-11 fill-current" strokeWidth={0} />
              ) : (
                <Play className="ml-1 h-11 w-11 fill-current" strokeWidth={0} />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                seekBy(SEEK_SECONDS)
              }}
              className="listen-video__button ed-focus justify-self-center"
              aria-label={t('Forward {seconds} seconds', { seconds: SEEK_SECONDS })}
            >
              <FastForward className="h-8 w-8 fill-current rtl:-scale-x-100" strokeWidth={0} />
            </button>
            <span className="justify-self-end">
              <SleepTopButton onOpen={onOpenSleep} className="listen-video__sleep" />
            </span>
          </div>
            </div>
          </div>

          <SeekBar className="mt-4" remaining />

          {/* Along the bottom: the translation's language, the scene behind, and the list of surahs. */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setLanguageOpen(true)
              }}
              className="listen-video__chip ed-focus"
              aria-label={`${t('Translation language')}: ${t(translationLanguageLabel(translationLanguage))}`}
            >
              <Languages className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
              <span className="truncate">{t(translationLanguageLabel(translationLanguage))}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setVolumeOpen(true)
              }}
              className="listen-video__button ed-focus ml-auto"
              aria-label={t('Volume')}
            >
              <Volume2 className="h-[22px] w-[22px]" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setBackgroundOpen(true)
              }}
              className="listen-video__button ed-focus"
              aria-label={t('Background')}
            >
              <ImageIcon className="h-[22px] w-[22px]" strokeWidth={1.9} />
            </button>
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                exit()
                onClose()
              }}
              className="listen-video__button ed-focus"
              aria-label={t('Surahs')}
            >
              <ListMusic className="h-6 w-6" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </div>

      <SettingsSheet open={languageOpen} title={t('Translation language')} onClose={() => setLanguageOpen(false)}>
        <div className="home-card overflow-hidden rounded-2xl">
          {TRANSLATION_LANGUAGES.map((lang) => {
            const on = lang === translationLanguage
            return (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  tapFeedback()
                  setAppSettings({ translationLanguage: lang, translationEditionId: DEFAULT_TRANSLATION_EDITION[lang] })
                  setLanguageOpen(false)
                }}
                className="set-row w-full"
                aria-pressed={on}
              >
                <span className="set-row__label">{t(translationLanguageLabel(lang))}</span>
                {on ? <Check className="h-[18px] w-[18px] shrink-0" strokeWidth={2.4} /> : null}
              </button>
            )
          })}
        </div>
      </SettingsSheet>

      <VolumeSheet open={volumeOpen} reciterName={reciter.name} onClose={() => setVolumeOpen(false)} />

      <SettingsSheet open={backgroundOpen} title={t('Background')} onClose={() => setBackgroundOpen(false)}>
        <div className="grid grid-cols-2 gap-2.5">
          {LISTEN_VIDEO_BACKGROUNDS.map((scene) => {
            const on = scene.id === background.id
            return (
              <button
                key={scene.id}
                type="button"
                onClick={() => {
                  tapFeedback()
                  setListenVideoBackground(scene.id)
                  setBackgroundOpen(false)
                }}
                className={cn(
                  'ed-focus relative aspect-[3/4] overflow-hidden rounded-2xl',
                  on && 'ring-2 ring-[var(--home-heading)] ring-offset-2 ring-offset-[var(--app-bg)]'
                )}
                aria-pressed={on}
                aria-label={t(scene.label)}
              >
                <img src={scene.thumb ?? scene.url ?? undefined} alt="" className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-left text-[0.8125rem] font-semibold text-white">
                  {t(scene.label)}
                </span>
                {on ? (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
                    <Check className="h-4 w-4" strokeWidth={2.6} />
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </SettingsSheet>
    </>,
    document.body
  )
}
