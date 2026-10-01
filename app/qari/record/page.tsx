'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { askToSignIn } from '@/lib/account-prompt'
import { getSignedInUser } from '@/lib/auth'
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  Globe,
  Hash,
  ImageIcon,
  Loader2,
  LayoutGrid,
  Lock,
  MicVocal,
  Pause,
  Play,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'
import BackgroundCover from '@/components/qari/BackgroundCover'
import MushafReadAlong from '@/components/qari/MushafReadAlong'
import { AudienceSheet, SheikhSheet, SoundSheet } from '@/components/qari/RecordPickers'
import { SheikhMonogram } from '@/components/qari/SheikhCards'
import Switch from '@/components/qari/Switch'
import Waveform from '@/components/qari/Waveform'
import { qariNotice, useViewer } from '@/components/qari/QariShell'
import AccountSheet from '@/components/settings/AccountSheet'
import BackgroundGallery from '@/components/share/BackgroundGallery'
import {
  microphoneError,
  prepareRecording,
  releasePrepared,
  useQariRecorder,
  type PreparedRecording,
} from '@/hooks/useQariRecorder'
import { createSpaceMixer, findSpace, type SpaceId, type SpaceMixer } from '@/lib/audio-space'
import { errorFeedback, strongFeedback, successFeedback, tapFeedback } from '@/lib/haptics'
import { toast } from '@/lib/toast'
import { formatDuration, tidyHashtags, type VerseTimelineEntry } from '@/lib/qari'
import {
  FEATURED_RECITATION_BACKGROUND_IDS,
  VIDEO_BACKGROUNDS,
  VIDEO_BACKGROUND_GROUPS,
  findVideoBackground,
  lastRecitationBackground,
  type VideoBackground,
} from '@/lib/qari-backgrounds'
import { useAyahMarking } from '@/hooks/useAyahMarking'
import { clearDraft, loadDraft, peekDraftMeta, saveDraftAudio, saveDraftMeta, type QariDraftMeta } from '@/lib/qari-drafts'
import { postRecitation } from '@/lib/qari-upload'
import { measurePeaks } from '@/lib/qari-waveform'
import { findSheikh, SHEIKHS } from '@/lib/sheikhs'
import { cn } from '@/lib/cn'
import { tr, useT } from '@/lib/i18n'

/**
 * Recording a recitation, in three steps like posting on TikTok:
 *
 *   record  full screen over the background it will be shown on, with the
 *           tools down the side and one big button
 *   edit    the take played back on that background, with the backgrounds
 *           to choose from in a strip underneath
 *   post    title, note, hashtags, who can hear it — then Post hands it to
 *           lib/qari-upload and goes to the profile, where it uploads
 */
type Step = 'ready' | 'countdown' | 'recording' | 'edit' | 'post'

const MAX_SECONDS = 600
const LIVE_BARS = 40
const MAX_TAGS = 6
const SUGGESTED_TAGS = ['tajweed', 'hifdh', 'murattal', 'fajr', 'juzamma', 'ramadan']

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** A confirm-by-tapping-twice switch that disarms itself after a moment. */
function useArmed(): [boolean, (on: boolean) => void] {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 2500)
    return () => window.clearTimeout(id)
  }, [armed])
  return [armed, setArmed]
}

function RecordFlow() {
  const t = useT()
  const params = useSearchParams()
  const router = useRouter()
  const viewer = useViewer()

  // Opened straight from a link without an account: ask now, before a recitation is recorded.
  useEffect(() => {
    if (getSignedInUser()) return
    askToSignIn({
      reason: t('Create a free account to record and share your recitation.'),
      onCancel: () => router.replace('/qari'),
    })
  }, [router, t])
  const recorder = useQariRecorder(MAX_SECONDS)
  const { state } = recorder

  // Arriving from a sheikh's page ("Imitate Sheikh Sufi") switches Imitate on.
  const preset = findSheikh(params.get('imitate'))
  const [spaceId, setSpaceId] = useState<SpaceId>('reciter')
  const [imitate, setImitate] = useState(Boolean(preset))
  const [sheikhId, setSheikhId] = useState(preset?.id ?? SHEIKHS[0].id)
  // Plain black until the one the last recitation went out on is read — it
  // lives on the phone, so only once mounted — rather than flashing another.
  const [backgroundId, setBackgroundId] = useState('black')
  useEffect(() => setBackgroundId(lastRecitationBackground()), [])

  const [step, setStep] = useState<Step>('ready')
  const [count, setCount] = useState(3)
  const preparedRef = useRef<PreparedRecording | null>(null)
  const countdownRef = useRef<number | null>(null)
  const [discardArmed, setDiscardArmed] = useArmed()
  const [draftDiscardArmed, setDraftDiscardArmed] = useArmed()
  const [retakeArmed, setRetakeArmed] = useArmed()

  const [levels, setLevels] = useState<number[]>([])

  const [peaks, setPeaks] = useState<number[]>([])
  const [title, setTitle] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [caption, setCaption] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [titleShake, setTitleShake] = useState(false)
  const [picker, setPicker] = useState<'sound' | 'sheikh' | 'audience' | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [draftMeta, setDraftMeta] = useState<QariDraftMeta | null>(null)
  // Some reciters read from the mushaf instead of memory — this opens a
  // read-only mushaf overlay on top of the record screen; the recording
  // itself (owned by useQariRecorder) keeps running underneath since this
  // never unmounts RecordFlow, just layers a full-screen view over it.
  const [mushafOpen, setMushafOpen] = useState(false)
  // Ayat marked "now reciting" while the Mushaf overlay is open.
  const [verseTimeline, setVerseTimeline] = useState<VerseTimelineEntry[]>([])
  // Ayat found by listening to the take on the phone, when the recitation model is saved.
  const marking = useAyahMarking(setVerseTimeline)
  const autoMarkRef = useRef(false)

  const sheikh = findSheikh(sheikhId)
  const space = findSpace(spaceId)
  const background = findVideoBackground(backgroundId)
  const editing = step === 'edit' || step === 'post'

  /* ---------------------------------------------------------- countdown */

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) window.clearInterval(countdownRef.current)
    countdownRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      clearCountdown()
      releasePrepared(preparedRef.current)
    }
  }, [clearCountdown])

  const begin = useCallback(async () => {
    if (!recorder.supported) {
      qariNotice(tr('This browser cannot record audio. Try Chrome on Android, or Safari on iPhone.'))
      return
    }
    strongFeedback()
    setStep('countdown')
    setCount(3)
    try {
      preparedRef.current = await prepareRecording()
    } catch (err) {
      setStep('ready')
      qariNotice(microphoneError(err))
      return
    }

    let remaining = 3
    countdownRef.current = window.setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        strongFeedback()
        setCount(remaining)
        return
      }
      clearCountdown()
      strongFeedback()
      setLevels([])
      setVerseTimeline([])
      setStep('recording')
      const prepared = preparedRef.current
      preparedRef.current = null
      void recorder.start(prepared ?? undefined)
    }, 850)
  }, [clearCountdown, recorder])

  const cancelCountdown = useCallback(() => {
    clearCountdown()
    releasePrepared(preparedRef.current)
    preparedRef.current = null
    setStep('ready')
  }, [clearCountdown])

  /* ---------------------------------------------------------- recording */

  // Sample the level on a steady beat, so the waveform keeps moving even
  // through a held note that does not change the level at all.
  const levelRef = useRef(0)
  levelRef.current = state.level
  useEffect(() => {
    if (!state.recording) return
    const id = window.setInterval(() => {
      setLevels((prev) => [...prev.slice(-(LIVE_BARS - 1)), levelRef.current])
    }, 90)
    return () => window.clearInterval(id)
  }, [state.recording])

  // Read from a ref rather than closed over directly, so marking a verse
  // (fired from deep inside the Mushaf overlay) always timestamps against
  // the true current elapsed time instead of whatever it was when the
  // callback identity was last created.
  const elapsedRef = useRef(0)
  elapsedRef.current = state.elapsed
  const handleMarkVerse = useCallback((verseKey: string) => {
    setVerseTimeline((prev) => [...prev, { verseKey, atSeconds: elapsedRef.current }])
  }, [])

  // A failure to start drops back to the start, saying why.
  useEffect(() => {
    if (state.error && step === 'recording') {
      setStep('ready')
      qariNotice(state.error)
    }
  }, [state.error, step])

  // A take just recorded, rather than a draft picked back up.
  const freshTakeRef = useRef(false)

  // When the take lands, move on to editing and measure its shape.
  useEffect(() => {
    if (!state.blob || step !== 'recording') return
    strongFeedback()
    freshTakeRef.current = true
    autoMarkRef.current = true
    marking.reset()
    setStep('edit')
    setPeaks([])
    measurePeaks(state.blob)
      .then(setPeaks)
      .catch(() => setPeaks([]))
    // Say so when the take could have been better, and how.
    if (state.quality === 'noisy') qariNotice(tr('The room was a little noisy. A quieter room sounds better.'))
    else if (state.quality === 'quiet') qariNotice(tr('The recording is quiet. Hold the phone closer next time.'))
    else if (state.quality === 'clipped') qariNotice(tr('The recording was too loud in places. Hold the phone further away next time.'))
  }, [state.blob, state.quality, step, marking.reset])

  // A new take gets its ayat marked on its own, unless some were marked by hand from the Mushaf.
  useEffect(() => {
    if (!autoMarkRef.current || !state.blob || step !== 'edit' || !marking.modelReady) return
    autoMarkRef.current = false
    if (verseTimeline.length === 0) void marking.start(state.blob)
  }, [marking.modelReady, marking.start, state.blob, step, verseTimeline.length])

  /* ---------------------------------------------------------- draft */

  // Offered on the record screen — checked fresh whenever we land back there.
  useEffect(() => {
    if (step === 'ready') setDraftMeta(peekDraftMeta())
  }, [step])

  const draftFieldsRef = useRef<Partial<QariDraftMeta>>({})
  draftFieldsRef.current = {
    title,
    hashtags,
    caption,
    isPrivate,
    imitating: imitate ? sheikhId : null,
    space: spaceId,
    peaks,
    verseTimeline,
    background: backgroundId,
  }

  // The recording itself, saved the moment a take is ready — before a title
  // is even typed, so backing out never costs the take.
  useEffect(() => {
    if (!editing || !state.blob) return
    const fresh = freshTakeRef.current
    freshTakeRef.current = false
    void saveDraftAudio(state.blob, state.mimeType, state.durationSec, { fresh, fields: () => draftFieldsRef.current })
  }, [editing, state.blob, state.mimeType, state.durationSec])

  // Everything chosen or typed since, kept in step with the saved audio.
  useEffect(() => {
    if (!editing || !state.blob) return
    saveDraftMeta(draftFieldsRef.current)
  }, [editing, state.blob, title, hashtags, caption, isPrivate, imitate, sheikhId, spaceId, peaks, verseTimeline, backgroundId])

  const resumeDraft = useCallback(async () => {
    tapFeedback()
    const draft = await loadDraft()
    if (!draft) {
      setDraftMeta(null)
      qariNotice(tr('That draft is no longer there.'))
      return
    }
    freshTakeRef.current = false
    recorder.adopt(draft.blob, draft.mimeType, draft.durationSec)
    setSpaceId((draft.space as SpaceId) || 'reciter')
    setImitate(Boolean(draft.imitating))
    if (draft.imitating) setSheikhId(draft.imitating)
    if (draft.background) setBackgroundId(findVideoBackground(draft.background).id)
    setPeaks(draft.peaks)
    setVerseTimeline(draft.verseTimeline ?? [])
    setTitle(draft.title)
    setHashtags(draft.hashtags)
    setCaption(draft.caption)
    setIsPrivate(draft.isPrivate)
    setStep('edit')
  }, [recorder])

  const discardDraft = useCallback(() => {
    if (!draftDiscardArmed) {
      tapFeedback()
      setDraftDiscardArmed(true)
      qariNotice(tr('Tap again to discard the draft.'))
      return
    }
    setDraftDiscardArmed(false)
    void clearDraft()
    setDraftMeta(null)
    qariNotice(tr('Draft discarded.'))
  }, [draftDiscardArmed, setDraftDiscardArmed])

  /* ---------------------------------------------------------- listen back */

  const previewRef = useRef<HTMLAudioElement | null>(null)
  const previewCtxRef = useRef<AudioContext | null>(null)
  const mixerRef = useRef<SpaceMixer | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)

  /* Changing the sound takes effect at once, even mid-playback. */
  useEffect(() => {
    mixerRef.current?.setSpace(findSpace(spaceId))
  }, [spaceId])

  const stopPreview = useCallback(() => {
    previewRef.current?.pause()
    if (previewRef.current?.src) URL.revokeObjectURL(previewRef.current.src)
    previewRef.current = null
    mixerRef.current = null
    void previewCtxRef.current?.close().catch(() => {})
    previewCtxRef.current = null
    setPreviewing(false)
    setPreviewProgress(0)
  }, [])

  useEffect(() => stopPreview, [stopPreview])

  const togglePreview = useCallback(() => {
    if (!state.blob) return
    tapFeedback()
    if (previewing) {
      previewRef.current?.pause()
      return
    }
    if (!previewRef.current) {
      const audio = new Audio(URL.createObjectURL(state.blob))
      audio.addEventListener('play', () => setPreviewing(true))
      audio.addEventListener('pause', () => setPreviewing(false))
      audio.addEventListener('ended', () => {
        setPreviewing(false)
        setPreviewProgress(0)
      })
      audio.addEventListener('timeupdate', () => {
        const total = Number.isFinite(audio.duration) ? audio.duration : state.durationSec
        if (total > 0) setPreviewProgress(Math.min(1, audio.currentTime / total))
      })
      previewRef.current = audio

      // Through the mixer, so this is exactly what listeners will hear.
      const ctx = new AudioContext()
      previewCtxRef.current = ctx
      const mixer = createSpaceMixer(ctx, ctx.createMediaElementSource(audio))
      mixer.output.connect(ctx.destination)
      mixer.setSpace(findSpace(spaceId))
      mixerRef.current = mixer
    }
    void previewCtxRef.current?.resume().catch(() => {})
    void previewRef.current.play().catch(() => qariNotice(tr('Could not play that back.')))
  }, [previewing, spaceId, state.blob, state.durationSec])

  const seekPreview = useCallback(
    (fraction: number) => {
      const audio = previewRef.current
      if (!audio) return
      const total = Number.isFinite(audio.duration) ? audio.duration : state.durationSec
      audio.currentTime = fraction * total
      setPreviewProgress(fraction)
    },
    [state.durationSec]
  )

  /** Clears what was typed for a take, so the next one starts empty. */
  const forgetTake = useCallback(() => {
    stopPreview()
    marking.reset()
    recorder.reset()
    setPeaks([])
    setVerseTimeline([])
    setTitle('')
    setHashtags('')
    setCaption('')
  }, [marking.reset, recorder, stopPreview])

  /** Back to the camera. The take stays as the draft, one tap away. */
  const backToCamera = useCallback(() => {
    tapFeedback()
    forgetTake()
    setStep('ready')
    qariNotice(tr('Kept in your drafts.'))
  }, [forgetTake])

  const recordAgain = useCallback(() => {
    if (!retakeArmed) {
      tapFeedback()
      setRetakeArmed(true)
      qariNotice(tr('Tap again to record again. This take will be discarded.'))
      return
    }
    setRetakeArmed(false)
    tapFeedback()
    forgetTake()
    setStep('ready')
    // This take is being abandoned on purpose, so the draft of it goes too.
    void clearDraft()
  }, [forgetTake, retakeArmed, setRetakeArmed])

  const toPost = useCallback(() => {
    tapFeedback()
    previewRef.current?.pause()
    setStep('post')
  }, [])

  /* ---------------------------------------------------------- post */

  const tags = useMemo(() => tidyHashtags(hashtags), [hashtags])

  const addTag = useCallback(
    (tag: string) => {
      if (tags.includes(tag) || tags.length >= MAX_TAGS) return
      tapFeedback()
      setHashtags((prev) => `${prev.trim()} #${tag}`.trim())
    },
    [tags]
  )

  const handlePost = useCallback(() => {
    if (!state.blob) return
    if (!viewer) {
      setAccountOpen(true)
      return
    }
    if (!title.trim()) {
      errorFeedback()
      toast(tr('Give your recitation a title.'))
      setTitleShake(true)
      window.setTimeout(() => setTitleShake(false), 450)
      document.getElementById('qari-title')?.focus()
      return
    }

    stopPreview()
    postRecitation({
      blob: state.blob,
      mimeType: state.mimeType,
      durationSec: state.durationSec,
      title: title.trim(),
      space: spaceId,
      hashtags: hashtags.trim(),
      isPrivate,
      caption: caption.trim(),
      imitating: imitate ? sheikhId : '',
      peaks,
      verseTimeline,
      background: backgroundId,
      userId: viewer.id,
      userName: viewer.name,
      userUsername: viewer.username,
    })
    successFeedback()
    // To the profile, where it shows uploading at the top.
    router.replace(`/qari/${encodeURIComponent(viewer.username)}`)
  }, [backgroundId, caption, hashtags, imitate, isPrivate, peaks, router, sheikhId, spaceId, state, stopPreview, title, verseTimeline, viewer])

  const saveToDrafts = useCallback(() => {
    tapFeedback()
    saveDraftMeta(draftFieldsRef.current)
    stopPreview()
    toast(tr('Saved to drafts.'), 'success')
    router.replace('/qari')
  }, [router, stopPreview])

  /* ---------------------------------------------------------- shared pieces */

  const pickers = (
    <>
      <SoundSheet open={picker === 'sound'} value={spaceId} onClose={() => setPicker(null)} onSelect={setSpaceId} />
      <SheikhSheet
        open={picker === 'sheikh'}
        value={sheikhId}
        onClose={() => setPicker(null)}
        onSelect={(id) => {
          setSheikhId(id)
          setImitate(true)
        }}
      />
      <AudienceSheet open={picker === 'audience'} isPrivate={isPrivate} onClose={() => setPicker(null)} onSelect={setIsPrivate} />
      <BackgroundGallery
        open={galleryOpen}
        items={VIDEO_BACKGROUNDS}
        groups={VIDEO_BACKGROUND_GROUPS}
        selectedId={backgroundId}
        onSelect={setBackgroundId}
        onClose={() => setGalleryOpen(false)}
      />
    </>
  )

  const openPicker = (which: 'sound' | 'sheikh' | 'audience') => {
    tapFeedback()
    setPicker(which)
  }

  const openGallery = () => {
    tapFeedback()
    setGalleryOpen(true)
  }

  /* ---------------------------------------------------------- post view */

  if (step === 'post' && state.blob) {
    return (
      <main className="qari-theme relative min-h-[100dvh] w-full text-[var(--app-text)]">
        <div className="mx-auto w-full max-w-lg px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <header className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <button type="button" onClick={() => setStep('edit')} aria-label={t('Back')} className="home-round ed-focus">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.9} />
            </button>
            <h1 className="home-serif text-center text-[1.3125rem] font-medium tracking-[-0.01em] text-[var(--home-heading)]">
              {t('Post')}
            </h1>
            <span aria-hidden />
          </header>

          <div className="qari-step">
            {/* What people will read, beside what they will see. */}
            <div className="home-card mt-5 rounded-[20px] p-3.5">
              <div className="flex gap-3.5">
                <div className="min-w-0 flex-1">
                  <label className={cn('block', titleShake && 'fx-shake')} htmlFor="qari-title">
                    <span className="sr-only">{t('Title')}</span>
                    <input
                      id="qari-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                      placeholder={t('Give it a title')}
                      enterKeyHint="next"
                      className="home-serif w-full bg-transparent text-[1.1875rem] font-medium leading-snug text-[var(--home-heading)] outline-none placeholder:text-[color-mix(in_srgb,var(--home-muted)_80%,transparent)]"
                    />
                  </label>
                  <label className="mt-2 block" htmlFor="qari-caption">
                    <span className="sr-only">{t('Note')}</span>
                    <textarea
                      id="qari-caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value.slice(0, 280))}
                      rows={4}
                      placeholder={t('Add a note: what you recited, or a du’a to ask for')}
                      className="w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-[var(--home-heading)] outline-none placeholder:text-[var(--home-muted)]"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback()
                    setStep('edit')
                  }}
                  aria-label={t('Change background')}
                  className="qari-press ed-focus relative aspect-[9/16] w-[5.75rem] shrink-0 self-start overflow-hidden rounded-[14px] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]"
                >
                  <BackgroundCover background={background} />
                  <span className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/70" />
                  <span className="absolute inset-x-2 top-1/2 -translate-y-1/2">
                    <Waveform peaks={peaks} seed={String(state.durationSec)} progress={0} bars={14} tone="dark" className="h-6 w-full" />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 pb-1.5 text-center text-[11px] font-semibold text-white">
                    {t('Change')}
                  </span>
                </button>
              </div>

              <div className="mt-3 border-t border-[var(--home-rule)] pt-3">
                <label className="flex items-center gap-2" htmlFor="qari-tags">
                  <Hash className="h-4 w-4 shrink-0 text-[var(--home-muted)]" strokeWidth={2} aria-hidden />
                  <span className="sr-only">{t('Hashtags')}</span>
                  <input
                    id="qari-tags"
                    type="text"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value.slice(0, 200))}
                    placeholder={t('Hashtags')}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full bg-transparent text-[14.5px] font-medium text-[var(--home-heading)] outline-none placeholder:font-normal placeholder:text-[var(--home-muted)]"
                  />
                </label>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="qari-chip qari-enter" style={{ height: '1.75rem', paddingInline: '0.625rem', fontSize: '0.78125rem' }}>
                      #{tag}
                    </span>
                  ))}
                  {tags.length < MAX_TAGS
                    ? SUGGESTED_TAGS.filter((tag) => !tags.includes(tag)).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          className="qari-press ed-focus flex h-7 items-center rounded-full border border-dashed border-[var(--home-rule-strong)] px-2.5 text-[12.5px] font-medium text-[var(--home-muted)]"
                        >
                          + #{tag}
                        </button>
                      ))
                    : null}
                </div>
              </div>
            </div>

            <p className="mx-1 mb-2 mt-6 text-[13px] font-medium text-[var(--home-muted)]">{t('Recitation')}</p>
            <div className="home-card overflow-hidden rounded-[20px]">
              <PostRow Icon={AudioLines} label={t('Sound')} value={t(space.label)} onClick={() => openPicker('sound')} />
              <RowDivider />
              <div className="set-row" style={{ paddingBlock: 8 }}>
                <span className="set-row__icon">
                  <MicVocal className="h-[17px] w-[17px]" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{t('Imitate a sheikh')}</span>
                  <span className="mt-px block truncate text-[12.5px] text-[var(--home-muted)]">{t('Also shows on his page')}</span>
                </span>
                <Switch checked={imitate} onChange={setImitate} label={t('Imitate a sheikh')} />
              </div>
              {imitate && sheikh ? (
                <div className="qari-enter">
                  <RowDivider />
                  <button type="button" className="set-row" style={{ paddingBlock: 8 }} onClick={() => openPicker('sheikh')}>
                    <SheikhMonogram sheikh={sheikh} size={30} />
                    <span className="set-row__label">{t('Sheikh')}</span>
                    <span className="set-row__value">{sheikh.shortName}</span>
                    <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
                  </button>
                </div>
              ) : null}
              {verseTimeline.length === 0 && marking.modelReady ? (
                <>
                  <RowDivider />
                  <button
                    type="button"
                    className="set-row"
                    style={{ paddingBlock: 10 }}
                    disabled={marking.status === 'running'}
                    onClick={() => {
                      tapFeedback()
                      void marking.start(state.blob as Blob)
                    }}
                  >
                    <span className="set-row__icon">
                      {marking.status === 'running' ? (
                        <Loader2 className="h-[17px] w-[17px] animate-spin" strokeWidth={1.9} />
                      ) : (
                        <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block text-[15px] font-medium">{t('Mark ayat automatically')}</span>
                      <span className="mt-px block truncate text-[12.5px] text-[var(--home-muted)]">
                        {marking.status === 'running'
                          ? t('Listening… {percent}%', { percent: Math.round(marking.progress * 100) })
                          : marking.status === 'none'
                            ? t('No ayat were recognised')
                            : marking.status === 'failed'
                              ? marking.error
                              : t('So each ayah shows as you recite it')}
                      </span>
                    </span>
                  </button>
                </>
              ) : null}
              {verseTimeline.length > 0 ? (
                <>
                  <RowDivider />
                  <div className="set-row" style={{ paddingBlock: 10 }}>
                    <span className="set-row__icon">
                      <BookOpen className="h-[17px] w-[17px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium">{t('Ayat marked')}</span>
                      <span className="mt-px block truncate text-[12.5px] text-[var(--home-muted)]">{t('Shown as you recite them')}</span>
                    </span>
                    <span className="set-row__value">{new Set(verseTimeline.map((e) => e.verseKey)).size}</span>
                  </div>
                </>
              ) : null}
              <RowDivider />
              <PostRow
                Icon={isPrivate ? Lock : Globe}
                label={t('Who can hear it')}
                value={isPrivate ? t('Only me') : t('Everyone')}
                onClick={() => openPicker('audience')}
              />
            </div>
            <p className="mx-1 mt-3 text-[12.5px] leading-relaxed text-[var(--home-muted)]">
              {isPrivate
                ? t('Only you can hear it, on your profile.')
                : imitate && sheikh
                  ? t("It appears in the Qari feed and on {shortName}'s page.", { shortName: sheikh.shortName })
                  : t('It appears in the Qari feed.')}{' '}
              {t('You can delete it any time from your profile.')}
            </p>
          </div>
        </div>

        <div className="qari-post-bar">
          <div className="mx-auto flex w-full max-w-lg gap-2.5">
            <button
              type="button"
              onClick={saveToDrafts}
              className="qari-press ed-focus flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border border-[var(--home-rule-strong)] text-[15px] font-semibold text-[var(--home-heading)]"
            >
              <FileAudio className="h-[17px] w-[17px]" strokeWidth={2} />
              {t('Drafts')}
            </button>
            <button
              type="button"
              onClick={handlePost}
              className="ed-ink ed-focus qari-press flex h-[52px] flex-[1.6] items-center justify-center gap-2 rounded-full text-[15px] font-semibold"
            >
              <Send className="h-[17px] w-[17px]" strokeWidth={2.1} />
              {!viewer ? t('Sign in to post') : isPrivate ? t('Save') : t('Post')}
            </button>
          </div>
        </div>

        {pickers}
        <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} onSuccess={() => {}} />
      </main>
    )
  }

  /* ---------------------------------------------------------- edit view */

  if (step === 'edit' && state.blob) {
    return (
      <Studio background={background} moving>
        <div className="flex items-center justify-between">
          <button type="button" onClick={backToCamera} aria-label={t('Back')} className="qari-cam-round qari-glass ed-focus">
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <span className="qari-cam-text text-[15px] font-semibold">{t('Preview')}</span>
          <span className="w-[2.625rem]" aria-hidden />
        </div>

        {marking.status !== 'idle' ? (
          <div className="mt-3 flex justify-center" aria-live="polite">
            <button
              type="button"
              disabled={marking.status === 'running' || marking.status === 'done'}
              onClick={() => void marking.start(state.blob as Blob)}
              className="qari-glass flex h-8 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold"
            >
              {marking.status === 'running' ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
                  {t('Marking ayat… {percent}%', { percent: Math.round(marking.progress * 100) })}
                </>
              ) : marking.status === 'done' ? (
                <>
                  <BookOpen className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {t('{count} ayat marked', { count: marking.count })}
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} />
                  {marking.status === 'none' ? t('No ayat recognised · try again') : t('Could not mark ayat · try again')}
                </>
              )}
            </button>
          </div>
        ) : null}

        <div className="relative flex min-h-0 flex-1">
          {/* Tap anywhere on the picture to listen. */}
          <button
            type="button"
            onClick={togglePreview}
            aria-label={previewing ? t('Pause') : t('Listen back')}
            className="flex flex-1 items-center justify-center"
          >
            <span
              className={cn(
                'qari-glass flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full transition-[opacity,transform] duration-200',
                previewing ? 'scale-90 opacity-0' : 'opacity-100'
              )}
            >
              <Play className="ml-1 h-8 w-8 fill-current" strokeWidth={0} />
            </span>
          </button>
          <div className="absolute -right-2 top-4 flex flex-col items-center gap-4">
            <Tool Icon={AudioLines} label={t(space.label)} onClick={() => openPicker('sound')} />
            <Tool
              Icon={MicVocal}
              label={imitate && sheikh ? sheikh.shortName : t('Imitate')}
              active={imitate}
              onClick={() => openPicker('sheikh')}
            />
          </div>
        </div>

        <div className="qari-glass flex items-center gap-3 rounded-2xl px-3 py-2.5">
          <button
            type="button"
            onClick={togglePreview}
            aria-label={previewing ? t('Pause') : t('Listen back')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#111]"
          >
            {previewing ? (
              <Pause key="pause" className="qari-swap h-4 w-4 fill-current" strokeWidth={0} />
            ) : (
              <Play key="play" className="qari-swap ml-0.5 h-4 w-4 fill-current" strokeWidth={0} />
            )}
          </button>
          <Waveform
            peaks={peaks}
            seed={String(state.durationSec)}
            progress={previewProgress}
            onSeek={previewRef.current ? seekPreview : undefined}
            tone="dark"
            className="h-8 min-w-0 flex-1"
            label={t('Position in your recording')}
          />
          <span className="shrink-0 text-xs font-medium tabular-nums text-white/80">{formatDuration(state.durationSec)}</span>
        </div>

        <p className="qari-cam-text mb-0.5 mt-4 text-[12.5px] font-semibold text-white/85">{t('Background')}</p>
        <BackgroundStrip selectedId={backgroundId} onSelect={setBackgroundId} onMore={openGallery} />

        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={recordAgain}
            className={cn(
              'qari-glass qari-press ed-focus flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full text-[14.5px] font-semibold',
              retakeArmed && 'text-rose-300'
            )}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.2} />
            {t('Record again')}
          </button>
          <button
            type="button"
            onClick={toPost}
            className="qari-press ed-focus flex h-[52px] flex-[1.3] items-center justify-center gap-2 rounded-full bg-[#0e7268] text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(14,114,104,0.8)]"
          >
            {t('Next')}
            <ArrowRight className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>

        {pickers}
      </Studio>
    )
  }

  /* ---------------------------------------------------------- record view */

  const recording = step === 'recording'
  const countingDown = step === 'countdown'
  const elapsed = recording ? state.elapsed : 0
  const left = MAX_SECONDS - elapsed
  const draftBackground = draftMeta?.background ? findVideoBackground(draftMeta.background) : background

  const closeButton = recording ? (
    <button
      type="button"
      aria-label={discardArmed ? t('Tap again to discard') : t('Discard recording')}
      title={discardArmed ? t('Tap again to discard') : t('Discard recording')}
      onClick={() => {
        if (!discardArmed) {
          tapFeedback()
          setDiscardArmed(true)
          qariNotice(tr('Tap again to discard this recording.'))
          return
        }
        setDiscardArmed(false)
        recorder.reset()
        setStep('ready')
        qariNotice(tr('Recording discarded.'))
      }}
      className={cn('qari-cam-round qari-glass ed-focus', discardArmed && 'text-rose-300')}
    >
      <X className="h-5 w-5" strokeWidth={2} />
    </button>
  ) : countingDown ? (
    <button type="button" aria-label={t('Cancel')} onClick={cancelCountdown} className="qari-cam-round qari-glass ed-focus">
      <X className="h-5 w-5" strokeWidth={2} />
    </button>
  ) : (
    <Link href="/qari" onClick={tapFeedback} aria-label={t('Close')} className="qari-cam-round qari-glass ed-focus">
      <X className="h-5 w-5" strokeWidth={2} />
    </Link>
  )

  return (
    <Studio background={background} moving deep={recording || countingDown}>
      <div className="flex items-center justify-between gap-2">
        {closeButton}
        {recording ? (
          <span className="qari-glass flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold tabular-nums">
            <span className="qari-rec-dot" />
            {state.paused ? t('Paused') : clock(elapsed)}
          </span>
        ) : countingDown ? (
          <span className="qari-cam-text text-[15px] font-semibold">{t('Get ready')}</span>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => openPicker('sheikh')}
              className="qari-glass qari-press ed-focus flex h-9 min-w-0 items-center gap-2 rounded-full pl-2 pr-3.5 text-[13px] font-semibold"
            >
              {imitate && sheikh ? (
                <SheikhMonogram sheikh={sheikh} size={24} />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center">
                  <MicVocal className="h-4 w-4" strokeWidth={2} />
                </span>
              )}
              <span className="truncate">
                {imitate && sheikh ? t('Imitating {shortName}', { shortName: sheikh.shortName }) : t('Imitate a sheikh')}
              </span>
            </button>
            {imitate ? (
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  setImitate(false)
                }}
                aria-label={t('Stop imitating')}
                className="qari-glass qari-press ed-focus flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              >
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            ) : null}
          </div>
        )}
        {recording ? (
          <button
            type="button"
            onClick={() => {
              tapFeedback()
              setMushafOpen(true)
            }}
            aria-label={t('Read from Mushaf')}
            className="qari-cam-round qari-glass ed-focus"
          >
            <BookOpen className="h-[18px] w-[18px]" strokeWidth={1.9} />
          </button>
        ) : (
          <span className="w-[2.625rem] shrink-0" aria-hidden />
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {step === 'ready' ? (
          <div className="qari-step absolute -right-2 top-5 flex flex-col items-center gap-4">
            <Tool Icon={ImageIcon} label={t('Background')} onClick={openGallery} />
            <Tool Icon={AudioLines} label={t(space.label)} onClick={() => openPicker('sound')} />
            <Tool
              Icon={BookOpen}
              label={t('Mushaf')}
              onClick={() => {
                tapFeedback()
                setMushafOpen(true)
              }}
            />
          </div>
        ) : null}

        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          {state.polishing ? (
            <div className="qari-glass w-full max-w-[17rem] rounded-3xl px-5 py-5 text-center" role="status">
              <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
              <p className="home-serif mt-3 text-[1.1875rem] font-medium">{t('Polishing your recitation…')}</p>
              <p className="mt-1 text-[13px] text-white/75" aria-live="polite">
                {state.polishStage === 'cleaning'
                  ? t('Removing room noise')
                  : state.polishStage === 'shaping'
                    ? t('Shaping the voice')
                    : state.polishStage === 'saving'
                      ? t('Saving')
                      : t('Levelling the sound')}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-200"
                  style={{ width: `${Math.round(Math.min(1, Math.max(0.03, state.polishProgress)) * 100)}%` }}
                />
              </div>
            </div>
          ) : countingDown ? (
            <span key={count} className="qari-count home-serif qari-cam-text text-[7.5rem] font-medium leading-none tabular-nums">
              {count}
            </span>
          ) : recording ? (
            <>
              <span className="home-serif qari-cam-text text-[3.75rem] font-medium leading-none tracking-[-0.03em] tabular-nums" aria-live="polite">
                {clock(elapsed)}
              </span>
              <LiveWave levels={levels} />
            </>
          ) : null}
        </div>
      </div>

      <div className={cn('flex flex-col items-center', state.polishing && 'invisible')}>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
          <div className="flex justify-center">
            {recording ? (
              <button
                type="button"
                onClick={() => {
                  tapFeedback()
                  if (state.paused) recorder.resume()
                  else recorder.pause()
                }}
                aria-label={state.paused ? t('Resume recording') : t('Pause recording')}
                aria-pressed={state.paused}
                className="qari-glass qari-press ed-focus flex h-12 w-12 items-center justify-center rounded-full"
              >
                {state.paused ? (
                  <Play className="ml-0.5 h-[18px] w-[18px] fill-current" strokeWidth={0} />
                ) : (
                  <Pause className="h-[18px] w-[18px] fill-current" strokeWidth={0} />
                )}
              </button>
            ) : step === 'ready' && draftMeta ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => void resumeDraft()}
                  aria-label={t('Resume draft')}
                  className="qari-press ed-focus flex flex-col items-center gap-1"
                >
                  <span className="relative block h-[3.25rem] w-[2.5rem] overflow-hidden rounded-[9px] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]">
                    <BackgroundCover background={draftBackground} small />
                    <span className="absolute inset-x-0 bottom-0 bg-black/55 py-px text-center text-[9.5px] font-semibold tabular-nums">
                      {formatDuration(draftMeta.durationSec)}
                    </span>
                  </span>
                  <span className="qari-cam-text text-[11px] font-semibold">{t('Draft')}</span>
                </button>
                <button
                  type="button"
                  onClick={discardDraft}
                  aria-label={t('Discard draft')}
                  className={cn(
                    'absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/30',
                    draftDiscardArmed && 'bg-rose-500'
                  )}
                >
                  <X className="h-3 w-3" strokeWidth={2.6} />
                </button>
              </div>
            ) : null}
          </div>

          <Shutter
            live={recording}
            disabled={countingDown}
            level={recording && !state.paused ? state.level : 0}
            progress={elapsed / MAX_SECONDS}
            label={recording ? t('Finish recording') : t('Start recording')}
            onClick={() => (recording ? recorder.stop() : void begin())}
          />

          <span aria-hidden />
        </div>

        <p
          key={state.inputHint ?? step}
          className={cn(
            'qari-step qari-cam-text mt-4 min-h-[1.25rem] px-6 text-center text-[12.5px] font-medium',
            recording && state.inputHint === 'loud'
              ? 'text-rose-200'
              : recording && state.inputHint === 'quiet'
                ? 'text-amber-200'
                : 'text-white/85'
          )}
          aria-live="polite"
        >
          {countingDown
            ? t('Get ready…')
            : !recording
              ? t('Tap to record · up to 10 minutes')
              : state.paused
                ? t('Paused. Tap play to carry on, or the square to finish.')
                : state.inputHint === 'loud'
                  ? t('Too loud — hold the phone a little further away')
                  : state.inputHint === 'quiet'
                    ? t('We can barely hear you — come a little closer')
                    : left <= 60
                      ? t('{left} seconds left', { left })
                      : t('Tap the square when you finish')}
        </p>
      </div>

      {pickers}
      <MushafReadAlong
        open={mushafOpen}
        onClose={() => setMushafOpen(false)}
        recording={recording}
        countingDown={countingDown}
        count={count}
        elapsedLabel={clock(elapsed)}
        onBegin={() => void begin()}
        onStop={() => recorder.stop()}
        onMarkVerse={handleMarkVerse}
      />
    </Studio>
  )
}

/* ------------------------------------------------------------ pieces */

/** Full screen over the background the recitation will be shown on. */
function Studio({
  background,
  moving = false,
  deep = false,
  children,
}: {
  background: VideoBackground
  moving?: boolean
  deep?: boolean
  children: React.ReactNode
}) {
  return (
    <main className="qari-cam">
      <BackgroundCover background={background} moving={moving} drift />
      <div className={cn('qari-cam__shade', deep && 'is-deep')} />
      <div className="qari-cam__body">{children}</div>
    </main>
  )
}

/** One of the tools down the right edge: a round glass icon with its name under it. */
function Tool({
  Icon,
  label,
  active = false,
  onClick,
}: {
  Icon: typeof AudioLines
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="qari-tool ed-focus">
      <span className={cn('qari-tool__icon qari-glass', active && '!bg-white !text-[#111]')}>
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <span className="qari-tool__label">{label}</span>
    </button>
  )
}

/** The record button: a red dot in a white ring, a stop square while recording, the ring filling as the time goes. */
function Shutter({
  live,
  disabled,
  level,
  progress,
  label,
  onClick,
}: {
  live: boolean
  disabled: boolean
  level: number
  progress: number
  label: string
  onClick: () => void
}) {
  // Square root, so a soft voice still visibly moves the glow.
  const v = Math.sqrt(Math.min(1, Math.max(0, level)))
  const r = 39.5
  const circumference = 2 * Math.PI * r
  return (
    <div className="relative flex items-center justify-center">
      <span
        className="pointer-events-none absolute inset-[-14px] rounded-full bg-white/15 transition-[transform,opacity] duration-100"
        style={{ transform: `scale(${0.82 + v * 0.3})`, opacity: live ? 0.35 + v * 0.65 : 0 }}
        aria-hidden
      />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn('qari-shutter ed-focus', live && 'is-live')}
      >
        {live ? (
          <svg viewBox="0 0 84 84" className="qari-shutter__ring" aria-hidden>
            <circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0.004, progress)))}
              className="transition-[stroke-dashoffset] duration-300 ease-linear"
            />
          </svg>
        ) : null}
        <span className="qari-shutter__core" />
      </button>
    </div>
  )
}

/** The backgrounds to choose from at a glance; the one in use is always among them. */
function BackgroundStrip({
  selectedId,
  onSelect,
  onMore,
}: {
  selectedId: string
  onSelect: (id: string) => void
  onMore: () => void
}) {
  const t = useT()
  const featured = FEATURED_RECITATION_BACKGROUND_IDS.map(findVideoBackground)
  const items = featured.some((b) => b.id === selectedId) ? featured : [findVideoBackground(selectedId), ...featured]
  return (
    <div className="qari-bg-strip" role="radiogroup" aria-label={t('Background')}>
      {items.map((b) => (
        <button
          key={b.id}
          type="button"
          role="radio"
          aria-checked={b.id === selectedId}
          onClick={() => {
            tapFeedback()
            onSelect(b.id)
          }}
          className="qari-bg-thumb ed-focus"
        >
          <span className="qari-bg-thumb__img">
            <BackgroundCover background={b} small />
            {b.videoUrl ? (
              <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/55">
                <Play className="ml-px h-2.5 w-2.5 fill-white" strokeWidth={0} />
              </span>
            ) : null}
          </span>
          <span className="qari-bg-thumb__label">{t(b.label)}</span>
        </button>
      ))}
      <button type="button" onClick={onMore} className="qari-bg-thumb ed-focus">
        <span className="qari-bg-thumb__img flex items-center justify-center bg-white/15">
          <LayoutGrid className="h-5 w-5 text-white" strokeWidth={1.9} />
        </span>
        <span className="qari-bg-thumb__label">{t('More')}</span>
      </button>
    </div>
  )
}

/** The take so far scrolling in from the right, towards a fixed playhead. */
function LiveWave({ levels }: { levels: number[] }) {
  const padded = [...Array.from({ length: Math.max(0, LIVE_BARS - levels.length) }, () => -1), ...levels]
  return (
    <div className="flex h-[76px] w-full max-w-[21rem] items-center" aria-hidden>
      <div className="flex h-full flex-1 items-center justify-end gap-[3px] pr-1.5">
        {padded.map((level, i) =>
          level < 0 ? (
            <span key={i} className="h-[3px] w-[3px] shrink-0 rounded-full bg-white/35" />
          ) : (
            <span
              key={i}
              className="w-[3px] shrink-0 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.25)] transition-[height] duration-100"
              // Square root, so a soft voice still moves the bars visibly.
              style={{ height: `${Math.max(6, Math.min(100, Math.sqrt(level) * 120))}%` }}
            />
          )
        )}
      </div>
      <span className="h-full w-0.5 shrink-0 rounded-full bg-[#ff5b57]" />
      <div className="flex h-full flex-1 items-center gap-[3px] overflow-hidden pl-2">
        {Array.from({ length: 22 }, (_, i) => (
          <span key={i} className="h-[3px] w-[3px] shrink-0 rounded-full bg-white/35" />
        ))}
      </div>
    </div>
  )
}

function PostRow({
  Icon,
  label,
  value,
  onClick,
}: {
  Icon: typeof AudioLines
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button type="button" className="set-row" style={{ paddingBlock: 10 }} onClick={onClick}>
      <span className="set-row__icon">
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </span>
      <span className="set-row__label">{label}</span>
      <span className="set-row__value">{value}</span>
      <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[var(--home-muted)]" strokeWidth={2} />
    </button>
  )
}

function RowDivider() {
  return <div className="set-row__divider" style={{ marginLeft: '3.5rem' }} />
}

export default function QariRecordPage() {
  return (
    <Suspense fallback={null}>
      <RecordFlow />
    </Suspense>
  )
}
