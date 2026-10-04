'use client'

import Link from 'next/link'
import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronUp, FastForward, Headphones, Loader2, Lock, Play, Plus, Share2 } from 'lucide-react'
import LikeButton from '@/components/qari/LikeButton'
import QariAvatar from '@/components/qari/QariAvatar'
import ReportReasonSheet from '@/components/qari/ReportReasonSheet'
import RowMenu from '@/components/qari/RowMenu'
import ShareSheet from '@/components/qari/ShareSheet'
import { useQariPlayer } from '@/hooks/useQariPlayer'
import { useRecitationActions } from '@/hooks/useRecitationActions'
import { BOTTOM_NAV_HEIGHT_REM } from '@/lib/bottom-nav'
import { tapFeedback } from '@/lib/haptics'
import {
  compactNumber,
  fetchFollowState,
  formatDuration,
  prefetchRecitationAudio,
  setFollowing,
  timeAgoLong,
  type Recitation,
  type VerseTimelineEntry,
} from '@/lib/qari'
import { loadAyah, peekAyah, viewerTranslation, type AyahView } from '@/lib/qari-ayah'
import { ayahParts, loadPartTranslation, partFor, wordAt } from '@/lib/qari-ayah-parts'
import { cycleQariTextMode, useQariTextMode, type QariTextMode } from '@/lib/qari-text-mode'
import { useAppSettings } from '@/hooks/useAppSettings'
import {
  pausePlayback,
  playRecitation,
  seekPlayback,
  setPlaybackRate,
  togglePlayback,
  type PlayerSnapshot,
} from '@/lib/qari-player'
import { findSheikh } from '@/lib/sheikhs'
import { recitationBackground } from '@/lib/qari-backgrounds'
import BackgroundCover from '@/components/qari/BackgroundCover'
import { askToSignIn } from '@/lib/account-prompt'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

const HINT_KEY = 'muyassar_qari_swipe_hint'

/** Swipe views mounted right now — one replacing another must not drop the dark bar between them. */
let swipeViewsOpen = 0

/** The ayah being recited: the last one marked at or before `position`, or the first before that. -1 with none. */
function currentEntryIndex(timeline: VerseTimelineEntry[], position: number): number {
  let found = timeline.length ? 0 : -1
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].atSeconds > position) break
    found = i
  }
  return found
}

const TEXT_SHADOW = '0 2px 16px rgba(0, 0, 0, 0.65)'
const TRANSLATION_SHADOW = '0 1px 8px rgba(0, 0, 0, 0.55)'

/** The phrase's type: as large as this, and only as small as that before it may take two lines. */
const LINE_MAX_PX = 27
const LINE_MIN_PX = 18

/** How faint a word is before the reciter reaches it. */
const UNSAID_OPACITY = 0.38

/**
 * A phrase of the ayah on one line, centred: set as large as fits the width,
 * so a short phrase is big and a longer one a little smaller. With `lit`, the
 * words not yet reached are faint and each lights up as it is said; without
 * it (no word times for this recitation) they are all lit.
 */
function AyahLine({ words, fontFamily, lit }: { words: string[]; fontFamily: string; lit: number | null }) {
  const ref = useRef<HTMLParagraphElement | null>(null)
  const [fit, setFit] = useState({ size: LINE_MAX_PX, wrap: false })
  const text = words.join(' ')
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Measured on one line, shrinking until it fits; one too long even at the smallest size wraps.
    el.style.whiteSpace = 'nowrap'
    let next = LINE_MAX_PX
    el.style.fontSize = `${next}px`
    while (next > LINE_MIN_PX && el.scrollWidth > el.clientWidth + 1) {
      next -= 1
      el.style.fontSize = `${next}px`
    }
    setFit({ size: next, wrap: el.scrollWidth > el.clientWidth + 1 })
  }, [text, fontFamily])
  return (
    <p
      ref={ref}
      dir="rtl"
      lang="ar"
      className="w-full text-center text-[var(--home-heading)]"
      // The mushaf font has no bold face; forcing one would distort the letters.
      style={{ fontFamily, fontSize: fit.size, whiteSpace: fit.wrap ? 'normal' : 'nowrap', lineHeight: 1.9, fontWeight: 400, textShadow: TEXT_SHADOW, wordSpacing: '0.12em' }}
    >
      {words.map((word, i) => (
        <Fragment key={i}>
          {i > 0 ? ' ' : null}
          <span className="transition-opacity duration-200 ease-out" style={{ opacity: lit === null || i < lit ? 1 : UNSAID_OPACITY }}>
            {word}
          </span>
        </Fragment>
      ))}
    </p>
  )
}

/**
 * The middle of a slide: the ayah being recited in the mushaf's script with its
 * translation below, changing as the voice moves on. Without marked ayat, the
 * title stands in its place.
 */
function AyahStage({
  recitation,
  position,
  near,
  paused,
}: {
  recitation: Recitation
  position: number
  near: boolean
  paused: boolean
}) {
  const timeline = useMemo(
    () => [...(recitation.verseTimeline ?? [])].sort((a, b) => a.atSeconds - b.atSeconds),
    [recitation.verseTimeline]
  )
  const entryIndex = currentEntryIndex(timeline, position)
  const entry = entryIndex >= 0 ? timeline[entryIndex] : undefined
  const key = entry?.verseKey
  // In the viewer's own language: the translation they read the Quran with.
  const edition = viewerTranslation(useAppSettings().translationEditionId)
  // The ayah and its translation, or either alone (the button on the right).
  const mode = useQariTextMode()
  const [ayah, setAyah] = useState<AyahView | null>(() => (key ? peekAyah(key, edition) : null))

  // The previous ayah stays up until the next one is ready, so the screen never blanks between them.
  useEffect(() => {
    if (!key) {
      setAyah(null)
      return
    }
    const known = peekAyah(key, edition)
    if (known) {
      setAyah(known)
      return
    }
    let cancelled = false
    void loadAyah(key, edition).then((view) => {
      if (!cancelled && view) setAyah(view)
    })
    return () => {
      cancelled = true
    }
  }, [edition, key])

  // Every marked ayah is fetched up front, so each change lands instantly.
  useEffect(() => {
    if (near) timeline.forEach((entry) => void loadAyah(entry.verseKey, edition))
  }, [edition, near, timeline])

  // A phrase at a time, cut where the mushaf pauses: the one holding the word being recited.
  const parts = useMemo(() => ayahParts(ayah?.pauseAfter ?? []), [ayah])
  const lastPartRef = useRef(0)
  let partIndex = lastPartRef.current
  // The word being said, when this recitation knows when each word starts.
  let saying: number | null = null
  if (ayah && entry && ayah.verseKey === key) {
    const endsAt = timeline[entryIndex + 1]?.atSeconds ?? recitation.durationSec
    const word = wordAt(entry, endsAt, position, ayah.words.length)
    partIndex = partFor(parts, word)
    if (entry.words?.length) saying = position >= entry.words[0] ? word : -1
  }
  partIndex = Math.min(partIndex, parts.length - 1)
  lastPartRef.current = partIndex
  const part = parts[partIndex]
  const split = parts.length > 1

  // Each part with the translation of just its words; all of the ayah's parts are asked for at once.
  const [partTexts, setPartTexts] = useState<Record<string, string | null>>({})
  useEffect(() => {
    if (!ayah || parts.length < 2) return
    let cancelled = false
    parts.forEach((p, k) => {
      void loadPartTranslation(ayah.verseKey, edition, p).then((text) => {
        if (!cancelled) setPartTexts((prev) => ({ ...prev, [`${edition}|${ayah.verseKey}|${k}`]: text }))
      })
    })
    return () => {
      cancelled = true
    }
  }, [ayah, edition, parts])
  const translation = ayah ? (split ? partTexts[`${edition}|${ayah.verseKey}|${partIndex}`] ?? null : ayah.translation) : null
  // The last phrase ends with the ayah's ornament and its number.
  const shownWords = ayah
    ? [...ayah.words.slice(part.start, part.end + 1), ...(partIndex === parts.length - 1 && ayah.endMark ? [ayah.endMark] : [])]
    : []
  // Words of this phrase already reached; the ornament lights with the ayah's last word.
  const lit =
    saying === null
      ? null
      : Math.max(0, Math.min(shownWords.length, saying - part.start + 1 + (ayah && saying >= ayah.words.length - 1 ? 1 : 0)))

  return (
    <div
      className={cn(
        'qari-no-scrollbar flex max-h-full w-full flex-col items-center overflow-y-auto text-center transition-opacity duration-300',
        paused && 'opacity-45'
      )}
    >
      {ayah ? (
        <div key={`${ayah.verseKey}-${partIndex}`} className="qari-phrase-in flex w-full flex-col items-center px-1">
          {mode !== 'translation' ? <AyahLine words={shownWords} fontFamily={ayah.fontFamily} lit={lit} /> : null}
          {translation && mode !== 'ayah' ? (
            <p
              dir={ayah.translationRtl ? 'rtl' : 'ltr'}
              lang={ayah.translationLang}
              className={cn(
                'max-w-[34ch] leading-relaxed',
                // On its own it is the text to read, so it is larger and fully bright.
                mode === 'translation'
                  ? 'text-[21px] text-[var(--home-heading)]'
                  : 'mt-2 text-[16px] text-[color-mix(in_srgb,var(--home-heading)_86%,transparent)]'
              )}
              // In Amiri, like the ayah: a light, classical face, never bold, with a softer
              // glow than the ayah's so the strokes stay thin.
              style={{
                fontFamily: 'var(--font-amiri), Amiri, serif',
                fontWeight: 400,
                textShadow: TRANSLATION_SHADOW,
                ...(ayah.translationRtl ? { fontSize: mode === 'translation' ? 22 : 17 } : {}),
              }}
            >
              {split && part.start > 0 ? '… ' : ''}
              {translation}
              {split && partIndex < parts.length - 1 ? ' …' : ''}
            </p>
          ) : null}
        </div>
      ) : timeline.length === 0 ? (
        <div className="qari-ayah-in flex flex-col items-center px-2">
          <svg viewBox="0 0 64 64" className="h-14 w-14 text-[var(--qari-gold-hi)] opacity-80" fill="none" aria-hidden>
            <path d="M18 18h28v28H18z" stroke="currentColor" strokeWidth="1.2" />
            <path d="M32 8 56 32 32 56 8 32z" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="32" cy="32" r="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <h2
            className="home-serif mt-4 line-clamp-4 text-[30px] font-medium leading-tight tracking-[-0.015em] text-[var(--home-heading)]"
            style={{ textShadow: TEXT_SHADOW }}
          >
            {recitation.title}
          </h2>
        </div>
      ) : (
        <Loader2 className="h-6 w-6 animate-spin text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
      )}
    </div>
  )
}

/** The background its reciter chose, drifting slowly; only mounted for the slides on or next to the screen. */
function Backdrop({ recitation, active, playing }: { recitation: Recitation; active: boolean; playing: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0d1f1c]" aria-hidden>
      <BackgroundCover background={recitationBackground(recitation)} moving={active} drift paused={!playing} />
      <div className={cn('qari-mist', !playing && 'is-paused')} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/75" />
    </div>
  )
}

/**
 * An ayah card filling the screen, the way a recitation's video does. Cards
 * are posted the shape of a phone screen; one that is not (made before they
 * were) sits framed over a blur of itself instead of being cut to fit.
 */
function AyahCardMedia({ src, alt }: { src: string; alt: string }) {
  const [framed, setFramed] = useState(false)
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0d1f1c]">
      {framed ? (
        <>
          <img src={src} alt="" aria-hidden decoding="async" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-80 blur-2xl" />
          <div
            className="absolute inset-x-0 flex items-center justify-center px-5"
            style={{ top: 'calc(4.75rem + env(safe-area-inset-top))', bottom: '17.75rem' }}
          >
            <img
              src={src}
              alt={alt}
              decoding="async"
              draggable={false}
              className="max-h-full max-w-full rounded-[18px] object-contain shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]"
            />
          </div>
        </>
      ) : (
        <img
          src={src}
          alt={alt}
          decoding="async"
          draggable={false}
          onLoad={(e) => setFramed(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight > 0.62)}
          className="qari-ayah-in absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Enough shade for the top bar and the details to read over the picture. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
    </div>
  )
}

interface SlideProps {
  recitation: Recitation
  active: boolean
  /** On screen or right next to it. */
  near: boolean
  /** The player's state, for the active slide only — the others pass null so they never re-render with it. */
  playback: PlayerSnapshot | null
  viewerId: string | null
  viewerUsername: string | null
  onToggle: (recitation: Recitation) => void
  onRemoved: (id: string) => void
  onUpdated?: (id: string, patch: Partial<Recitation>) => void
  onNotice: (message: string) => void
}

/** How long a finger must stay down before it counts as a hold, and how fast a hold plays. */
const HOLD_MS = 380
const HOLD_RATE = 2

/**
 * The thin line along the bottom edge. It fills as the recitation plays, and
 * dragging along it seeks, with the times shown while a finger is on it.
 */
function ProgressLine({
  progress,
  position,
  duration,
  onSeek,
}: {
  progress: number
  position: number
  duration: number
  onSeek?: (fraction: number) => void
}) {
  const t = useT()
  const [scrubbing, setScrubbing] = useState(false)
  const seekFrom = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onSeek) return
    const rect = event.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)))
  }
  return (
    <div
      role={onSeek ? 'slider' : undefined}
      aria-label={onSeek ? t('Position') : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={(e) => {
        if (!onSeek) return
        setScrubbing(true)
        e.currentTarget.setPointerCapture(e.pointerId)
        seekFrom(e)
      }}
      onPointerMove={(e) => {
        if (scrubbing) seekFrom(e)
      }}
      onPointerUp={() => setScrubbing(false)}
      onPointerCancel={() => setScrubbing(false)}
      className="absolute inset-x-0 bottom-0 flex h-7 touch-none items-end"
    >
      {scrubbing ? (
        <span className="absolute bottom-4 left-0 right-0 text-center text-[13px] font-medium tabular-nums text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
          {formatDuration(position)} <span className="opacity-60">/ {formatDuration(duration)}</span>
        </span>
      ) : null}
      <div className={cn('relative w-full bg-white/25 transition-[height] duration-150', scrubbing ? 'h-[7px]' : 'h-[3px]')}>
        <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  )
}

const TEXT_MODE_NOTICE: Record<QariTextMode, string> = {
  both: 'Ayah and translation',
  ayah: 'Ayah only',
  translation: 'Translation only',
}

/**
 * One button for what shows over the recitation: the ayah and its
 * translation, the ayah alone, or the translation alone, in turn. The mark on
 * it shows the choice: ع for the ayah, A for the translation, both for both.
 */
function TextModeButton({ onNotice }: { onNotice: (message: string) => void }) {
  const t = useT()
  const mode = useQariTextMode()
  return (
    <button
      type="button"
      onClick={() => {
        tapFeedback()
        onNotice(tr(TEXT_MODE_NOTICE[cycleQariTextMode()]))
      }}
      aria-label={t('Show: {mode}', { mode: t(TEXT_MODE_NOTICE[mode]) })}
      className="qari-press ed-focus flex h-12 w-12 items-center justify-center rounded-full text-white"
    >
      <span
        aria-hidden
        className="flex h-[30px] min-w-[30px] items-center justify-center gap-[3px] rounded-[9px] border-[1.8px] border-current px-[5px] leading-none"
      >
        {mode !== 'translation' ? (
          <span className="text-[17px]" style={{ fontFamily: 'var(--font-amiri), Amiri, serif', transform: 'translateY(-1px)' }}>
            ع
          </span>
        ) : null}
        {mode === 'both' ? <span className="h-3.5 w-px bg-current opacity-60" /> : null}
        {mode !== 'ayah' ? <span className="home-serif text-[14px] font-semibold">A</span> : null}
      </span>
    </button>
  )
}

const Slide = memo(function Slide({
  recitation,
  active,
  near,
  playback,
  viewerId,
  viewerUsername,
  onToggle,
  onRemoved,
  onUpdated,
  onNotice,
}: SlideProps) {
  const t = useT()
  const {
    isOwner,
    isPrivate,
    shareOpen,
    setShareOpen,
    reportOpen,
    setReportOpen,
    handleDelete,
    handleTogglePrivacy,
    handleReportTap,
    handleReportReason,
    handleBlock,
  } = useRecitationActions({ recitation, viewerId, viewerUsername, onRemoved, onUpdated, onNotice })

  const isCurrent = playback?.current?.id === recitation.id
  const status = isCurrent ? playback!.status : 'idle'
  const position = isCurrent ? playback!.position : 0
  const duration = isCurrent && playback!.duration > 0 ? playback!.duration : recitation.durationSec
  const progress = duration > 0 ? Math.min(1, position / duration) : 0
  const playing = status === 'playing' || status === 'loading'
  const hasTimeline = (recitation.verseTimeline ?? []).length > 0
  // A picture made on the Read screen: nothing to play, so no tap-to-play, hold or progress line.
  const isAyahCard = recitation.kind === 'ayah'
  const sheikh = findSheikh(recitation.imitating)
  const firstTag = recitation.hashtags[0]
  const profileHref = `/qari/${encodeURIComponent(recitation.userUsername)}`

  /* Follow, from the reciter's picture — only asked for once this is the slide on screen. */
  const [following, setFollowingState] = useState<boolean | null>(null)
  useEffect(() => {
    if (!active || isOwner) return
    if (!viewerId) {
      setFollowingState(false)
      return
    }
    let cancelled = false
    void fetchFollowState(recitation.userUsername, viewerId).then((state) => !cancelled && setFollowingState(state.following))
    return () => {
      cancelled = true
    }
  }, [active, isOwner, recitation.userUsername, viewerId])

  const follow = useCallback(async () => {
    if (!viewerId || !viewerUsername) {
      askToSignIn({ reason: tr('Create a free account to follow qaris.') })
      return
    }
    tapFeedback()
    setFollowingState(true)
    try {
      await setFollowing({ id: viewerId, username: viewerUsername }, recitation.userUsername, true)
    } catch (err) {
      setFollowingState(false)
      onNotice(err instanceof Error ? err.message : tr('Could not update that.'))
    }
  }, [onNotice, recitation.userUsername, viewerId, viewerUsername])

  /* A tap on empty space plays or pauses; holding it plays at double speed until let go. */
  const holdTimer = useRef<number | undefined>(undefined)
  const holding = useRef(false)
  const justHeld = useRef(false)
  const [fast, setFast] = useState(false)

  const endHold = useCallback(() => {
    window.clearTimeout(holdTimer.current)
    if (!holding.current) return
    holding.current = false
    setFast(false)
    setPlaybackRate(1)
    // The click that follows letting go must not also pause it.
    justHeld.current = true
    window.setTimeout(() => {
      justHeld.current = false
    }, 80)
  }, [])

  // Swiping away, or the slide being torn down, mid-hold must not leave it fast.
  useEffect(() => {
    if (!active) endHold()
    return endHold
  }, [active, endHold])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!active || isAyahCard) return
      if ((event.target as HTMLElement).closest('a, button, input, [role="slider"], [role="dialog"]')) return
      window.clearTimeout(holdTimer.current)
      holdTimer.current = window.setTimeout(() => {
        holding.current = true
        setFast(true)
        setPlaybackRate(HOLD_RATE)
        tapFeedback()
      }, HOLD_MS)
    },
    [active, isAyahCard]
  )

  const onTap = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!active || justHeld.current || isAyahCard) return
      const target = event.target as HTMLElement
      if (!event.currentTarget.contains(target)) return
      if (target.closest('a, button, input, [role="slider"], [role="dialog"]')) return
      onToggle(recitation)
    },
    [active, isAyahCard, onToggle, recitation]
  )

  const showFollow = active && !isOwner && following === false

  return (
    <section
      data-recitation={recitation.id}
      aria-label={recitation.title}
      className="relative h-full w-full select-none overflow-hidden bg-[#0d1f1c] [-webkit-touch-callout:none]"
      onClick={onTap}
      onPointerDown={onPointerDown}
      onPointerUp={endHold}
      onPointerCancel={endHold}
      onPointerLeave={endHold}
      onContextMenu={(e) => e.preventDefault()}
    >
      {near ? (
        isAyahCard && recitation.imageUrl ? (
          <AyahCardMedia src={recitation.imageUrl} alt={t('Ayah card for {verseKey}', { verseKey: recitation.verseKey ?? '' })} />
        ) : (
          <Backdrop recitation={recitation} active={active} playing={active && playing} />
        )
      ) : null}

      {isAyahCard ? null : (
        // The ayah, in the middle of the screen: as far from the top as from the
        // bottom, and far enough from both to stay clear of the bar and the name.
        <div
          className="absolute inset-x-0 flex items-center justify-center px-6"
          style={{ top: 'calc(10rem + env(safe-area-inset-top))', bottom: 'calc(10rem + env(safe-area-inset-top))' }}
        >
          {near ? <AyahStage recitation={recitation} position={position} near={near} paused={active && !playing} /> : null}
          {active && !playing ? (
            <button
              type="button"
              onClick={() => onToggle(recitation)}
              aria-label={t('Play {label}', { label: recitation.title })}
              className="qari-press ed-focus absolute flex h-[68px] w-[68px] items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm"
            >
              <Play className="ml-1 h-8 w-8 fill-current" strokeWidth={0} />
            </button>
          ) : null}
        </div>
      )}

      {fast ? (
        <div
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          style={{ top: 'calc(4.5rem + env(safe-area-inset-top))' }}
          aria-live="polite"
        >
          <span className="qari-ayah-in flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[13px] font-medium text-white backdrop-blur-sm">
            <FastForward className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden />
            {t('{rate}× speed', { rate: HOLD_RATE })}
          </span>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-lg px-4 pb-6">
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1 pb-1" style={{ textShadow: '0 1px 10px rgba(0, 0, 0, 0.6)' }}>
            <Link href={profileHref} className="ed-focus inline-flex max-w-full items-center gap-1.5 rounded text-[16px] font-bold text-white">
              <span className="truncate">@{recitation.userUsername}</span>
              {isPrivate ? <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} aria-label={t('Only you')} /> : null}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/75">
              <span className="truncate">{timeAgoLong(recitation.createdAt)}</span>
              {recitation.playCount > 0 ? (
                <span
                  className="flex shrink-0 items-center gap-1 tabular-nums"
                  aria-label={t('{playCount} plays', { playCount: recitation.playCount })}
                >
                  · <Headphones className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                  {compactNumber(recitation.playCount)}
                </span>
              ) : null}
            </p>

            {hasTimeline || isAyahCard ? (
              <h2 className="mt-2 line-clamp-2 text-[15.5px] font-medium leading-snug text-white">{recitation.title}</h2>
            ) : null}

            {recitation.caption ? (
              <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-white/85">{recitation.caption}</p>
            ) : null}

            {sheikh || firstTag ? (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                {sheikh ? (
                  <Link href={`/qari/sheikh/${sheikh.id}`} className="qari-chip qari-chip--gold qari-press ed-focus">
                    {t('Imitating')} {sheikh.shortName}
                  </Link>
                ) : null}
                {firstTag ? (
                  <Link href={`/qari?q=${encodeURIComponent(`#${firstTag}`)}`} className="qari-chip qari-press ed-focus">
                    #{firstTag}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* The column of actions down the right edge. */}
          <div className="flex shrink-0 flex-col items-center gap-3 drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)]">
            <div className="relative mb-3">
              <Link
                href={profileHref}
                aria-label={t('{userName}’s profile', { userName: recitation.userName })}
                className="qari-press ed-focus isolate block rounded-full bg-white p-[2px]"
              >
                <QariAvatar username={recitation.userUsername} name={recitation.userName} size={46} />
              </Link>
              {showFollow ? (
                <button
                  type="button"
                  onClick={() => void follow()}
                  aria-label={t('Follow {name}', { name: recitation.userName })}
                  className="qari-pop qari-press ed-focus absolute -bottom-2.5 left-1/2 flex h-[22px] w-[22px] -translate-x-1/2 items-center justify-center rounded-full bg-[var(--home-sage)] text-[#0f2723] before:absolute before:-inset-2 before:content-['']"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              ) : null}
            </div>
            <div className="[&>button]:h-auto [&>button]:flex-col [&>button]:gap-0.5 [&>button]:py-1 [&>button>svg]:h-8 [&>button>svg]:w-8 [&>button]:text-[12px] [&>button]:font-medium">
              <LikeButton recitation={recitation} viewerId={viewerId} onNotice={onNotice} />
            </div>
            {hasTimeline && !isAyahCard ? <TextModeButton onNotice={onNotice} /> : null}
            <button
              type="button"
              onClick={() => {
                tapFeedback()
                setShareOpen(true)
              }}
              aria-label={t('Share')}
              className="qari-press ed-focus flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] font-medium text-white"
            >
              <Share2 className="h-[28px] w-[28px]" strokeWidth={1.9} />
            </button>
            <div className="[&>div>button:first-child]:h-11 [&>div>button:first-child]:w-11 [&>div>button:first-child]:text-white [&>div>button:first-child>svg]:h-7 [&>div>button:first-child>svg]:w-7">
              <RowMenu
                isOwner={isOwner}
                isPrivate={isPrivate}
                onTogglePrivacy={isOwner ? () => void handleTogglePrivacy() : undefined}
                onReport={handleReportTap}
                onDelete={() => void handleDelete()}
                blockUsername={recitation.userUsername}
                onBlock={() => void handleBlock()}
              />
            </div>
          </div>
        </div>
      </div>

      {isAyahCard ? null : (
        <ProgressLine
          progress={progress}
          position={position}
          duration={duration}
          onSeek={active && isCurrent ? seekPlayback : undefined}
        />
      )}

      <ShareSheet recitation={recitation} open={shareOpen} onClose={() => setShareOpen(false)} onNotice={onNotice} videoView />
      <ReportReasonSheet open={reportOpen} onClose={() => setReportOpen(false)} onPick={(reason) => void handleReportReason(reason)} />
    </section>
  )
})

/**
 * Recitations one to a screen. Swipe up for the next, down for the one before;
 * the voice plays as each one settles, and the ayah being recited follows it.
 * A tap on empty space pauses or plays.
 */
export default function SwipeFeed({
  items,
  loading = false,
  hasMore,
  loadingMore,
  onLoadMore,
  startId,
  autoplay,
  viewerId,
  viewerUsername,
  onRemoved,
  onUpdated,
  onNotice,
  empty,
}: {
  items: Recitation[]
  loading?: boolean
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  /** The recitation to open on. */
  startId?: string | null
  /** Start playing at once. Needs a tap to have happened just before — otherwise the browser refuses. */
  autoplay: boolean
  viewerId: string | null
  viewerUsername: string | null
  onRemoved: (id: string) => void
  onUpdated?: (id: string, patch: Partial<Recitation>) => void
  onNotice: (message: string) => void
  /** Shown in place of the slides when there is nothing to show. */
  empty?: React.ReactNode
}) {
  const t = useT()
  const player = useQariPlayer()
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const settleTimer = useRef<number | undefined>(undefined)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const [active, setActive] = useState(() => {
    const playingIndex = player.current ? items.findIndex((r) => r.id === player.current!.id) : -1
    const startIndex = startId ? items.findIndex((r) => r.id === startId) : -1
    return Math.max(0, startIndex >= 0 ? startIndex : playingIndex)
  })
  const activeRef = useRef(active)
  const playerIdRef = useRef<string | null>(player.current?.id ?? null)
  playerIdRef.current = player.current?.id ?? null
  // Playing on swipe needs the browser to have been given a tap first.
  const armed = useRef(autoplay || Boolean(player.current))
  const [hintSeen, setHintSeen] = useState(true)

  const clampedActive = Math.min(active, Math.max(0, items.length - 1))

  const pageHeight = () => scrollerRef.current?.clientHeight || 1

  // While this is on screen the bottom bar turns black with it (see .qari-swipe-open in globals.css).
  useEffect(() => {
    swipeViewsOpen += 1
    document.documentElement.classList.add('qari-swipe-open')
    return () => {
      swipeViewsOpen -= 1
      if (swipeViewsOpen === 0) document.documentElement.classList.remove('qari-swipe-open')
    }
  }, [])

  // Open on the chosen recitation, without animating there.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (el && el.clientHeight) el.scrollTop = activeRef.current * el.clientHeight
  }, [])

  useEffect(() => {
    try {
      setHintSeen(localStorage.getItem(HINT_KEY) === '1')
    } catch {
      setHintSeen(true)
    }
  }, [])

  // Autoplay the recitation opened on, once, when the list first has something in it.
  const hasItems = items.length > 0
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !hasItems) return
    started.current = true
    const list = itemsRef.current
    const first = list[Math.min(activeRef.current, list.length - 1)]
    if (autoplay && first && first.kind !== 'ayah' && playerIdRef.current !== first.id) playRecitation(first, { queue: list, viewerId })
  }, [autoplay, hasItems, viewerId])

  // True while the one that was playing has been paused because a swipe left it.
  const pausedBySwipe = useRef(false)

  const settle = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const landed = itemsRef.current[Math.round(el.scrollTop / pageHeight())]
    // An ayah card has nothing to play; whatever was playing already stopped on the way here.
    if (!landed || !armed.current || landed.kind === 'ayah') return
    if (playerIdRef.current !== landed.id || pausedBySwipe.current) {
      pausedBySwipe.current = false
      playRecitation(landed, { queue: itemsRef.current, viewerId })
    }
  }, [viewerId])

  const onScroll = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const index = Math.round(el.scrollTop / pageHeight())
    if (index !== activeRef.current) {
      activeRef.current = index
      setActive(index)
      // The moment a swipe carries the next page past halfway, the last voice stops —
      // it does not wait for the new one to load.
      if (playerIdRef.current && itemsRef.current[index]?.id !== playerIdRef.current) {
        pausedBySwipe.current = true
        pausePlayback()
      }
      if (index > 0) {
        try {
          localStorage.setItem(HINT_KEY, '1')
        } catch {
          // The hint just shows again next time.
        }
        setHintSeen(true)
      }
    }
    // Once the swipe has come to rest, play whatever it landed on.
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(settle, 90)
  }, [settle])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  // When the feed moves on by itself (a recitation ended), follow it.
  const currentId = player.current?.id ?? null
  // Only a change after opening counts: what was playing when this opened is not a reason to move.
  const seenId = useRef(currentId)
  useEffect(() => {
    if (!currentId || currentId === seenId.current) return
    seenId.current = currentId
    const index = itemsRef.current.findIndex((r) => r.id === currentId)
    if (index < 0 || index === activeRef.current) return
    const el = scrollerRef.current
    if (el) el.scrollTo({ top: index * pageHeight(), behavior: 'smooth' })
  }, [currentId])

  // Keep the next one's audio warm, and ask for more before the end.
  const askedAt = useRef(-1)
  useEffect(() => {
    // Download the ones a swipe will land on next, so they start the instant they settle.
    for (const near of [items[clampedActive], items[clampedActive + 1], items[clampedActive + 2], items[clampedActive - 1]]) {
      if (near && near.kind !== 'ayah') void prefetchRecitationAudio(near.id)
    }
    // Once per length of the list, so a failed request is not retried in a loop.
    if (hasMore && !loadingMore && items.length > 0 && clampedActive >= items.length - 3 && askedAt.current !== items.length) {
      askedAt.current = items.length
      onLoadMore()
    }
  }, [clampedActive, hasMore, items, loadingMore, onLoadMore])

  const onToggle = useCallback(
    (recitation: Recitation) => {
      armed.current = true
      togglePlayback(recitation, { queue: itemsRef.current, viewerId })
    },
    [viewerId]
  )

  const goTo = (index: number) => {
    scrollerRef.current?.scrollTo({ top: index * pageHeight(), behavior: 'smooth' })
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      event.preventDefault()
      goTo(Math.min(items.length, activeRef.current + 1))
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault()
      goTo(Math.max(0, activeRef.current - 1))
    }
  }

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      tabIndex={0}
      aria-label={t('Recitations')}
      className="qari-swipe qari-swipe-scroller fixed inset-x-0 top-0 z-30 overflow-y-scroll bg-[#0d1f1c]"
      style={{ bottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom))` }}
    >
      {items.length === 0 && loading ? (
        <section className="qari-swipe-slide flex h-full w-full items-center justify-center" aria-hidden>
          <span className="qari-skeleton h-24 w-24 rounded-full opacity-50" />
        </section>
      ) : null}

      {items.length === 0 && !loading && empty ? (
        <section className="qari-swipe-slide flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center">
          {empty}
        </section>
      ) : null}

      {items.map((recitation, i) => (
        <div key={recitation.id} className="qari-swipe-slide h-full w-full">
          <Slide
            recitation={recitation}
            active={i === clampedActive}
            near={Math.abs(i - clampedActive) <= 1}
            playback={i === clampedActive ? player : null}
            viewerId={viewerId}
            viewerUsername={viewerUsername}
            onToggle={onToggle}
            onRemoved={onRemoved}
            onUpdated={onUpdated}
            onNotice={onNotice}
          />
        </div>
      ))}

      {items.length > 0 ? (
        <section className="qari-swipe-slide flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center">
          {hasMore ? (
            loadingMore ? (
              <Loader2 className="h-6 w-6 animate-spin text-[var(--home-muted)]" strokeWidth={2} aria-label={t('Loading')} />
            ) : (
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  onLoadMore()
                }}
                className="qari-pill qari-press ed-focus"
                style={{ height: '2.5rem', padding: '0 1.25rem' }}
              >
                {t('Show more')}
              </button>
            )
          ) : (
            <>
              <p className="home-serif text-[24px] font-medium tracking-[-0.01em] text-[var(--home-heading)]">
                {t('You’re all caught up')}
              </p>
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  goTo(0)
                }}
                className="qari-pill qari-press ed-focus"
                style={{ height: '2.5rem', padding: '0 1.25rem' }}
              >
                {t('Back to the top')}
              </button>
            </>
          )}
        </section>
      ) : null}

      {/* Only on the very first slide, only until someone has swiped once. */}
      {!hintSeen && clampedActive === 0 && items.length > 1 ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center text-[11px] text-[var(--home-muted)]"
          style={{ bottom: `calc(${BOTTOM_NAV_HEIGHT_REM}rem + env(safe-area-inset-bottom) + 8.5rem)` }}
          aria-hidden
        >
          <ChevronUp className="qari-hint h-5 w-5" strokeWidth={2} />
          {t('Swipe up for the next one')}
        </div>
      ) : null}
    </div>
  )
}
