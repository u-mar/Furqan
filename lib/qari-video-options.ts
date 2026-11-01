import { useSyncExternalStore } from 'react'
import { findVideoBackground } from '@/lib/qari-backgrounds'

/**
 * The person's video choices, kept on the phone: the background a shared
 * video starts on, whether videos cut to other clips like it as each ayah
 * starts, and how sharp they are made. Their own small module, so Settings can
 * show the choices without loading the video maker.
 */

/** How sharp the video is made: the person chooses, trading time to make it and file size. */
export type VideoQuality = 'standard' | 'high' | 'best'

export const VIDEO_QUALITIES: Record<VideoQuality, { width: number; bitrate: number; label: string; resolution: string }> = {
  /** 720p at about what TikTok and Instagram keep once they re-encode: quick to make, small to send. */
  standard: { width: 720, bitrate: 2_500_000, label: 'Standard', resolution: '720p' },
  /** Full HD: the script and the translation stay crisp on any phone. */
  high: { width: 1080, bitrate: 6_000_000, label: 'High', resolution: '1080p' },
  /** Full HD with room to spare for the moving backgrounds' detail; the largest file. */
  best: { width: 1080, bitrate: 10_000_000, label: 'Best', resolution: '1080p' },
}

export const VIDEO_QUALITY_ORDER: VideoQuality[] = ['standard', 'high', 'best']

/** About how large a video of `seconds` comes out at this quality, in MB (the sound included). */
export function videoSizeMb(quality: VideoQuality, seconds: number): number {
  const bits = (VIDEO_QUALITIES[quality].bitrate + 192_000) * Math.max(1, seconds + 2)
  return Math.max(1, Math.round(bits / 8 / 1_000_000))
}

export interface VideoOptions {
  /** One of VIDEO_BACKGROUNDS' ids. */
  backgroundId: string
  /** Cut to other clips of the same kind as each ayah starts, rather than the chosen clip alone. */
  mix: boolean
  /** How sharp the video is made. */
  quality: VideoQuality
}

/** Just the chosen clip, the whole way through, in full HD, until the person asks otherwise. */
export const DEFAULT_VIDEO_OPTIONS: VideoOptions = {
  backgroundId: 'black',
  mix: false,
  quality: 'high',
}

function isVideoQuality(value: unknown): value is VideoQuality {
  return value === 'standard' || value === 'high' || value === 'best'
}

/**
 * Raised when what the options mean changes. Mixing used to be on unless
 * turned off and was saved with every video made, so a saved "on" was mostly
 * the old default rather than a choice: from this version mixing is off until
 * turned on.
 */
const VIDEO_OPTIONS_VERSION = 3

const VIDEO_OPTIONS_KEY = 'muyassar_qari_video_options'
const CHANGED_EVENT = 'qari-video-options-changed'

/**
 * Whether cutting between similar clips is offered at all. Off for now: every
 * video keeps the one clip chosen, the whole way through. Setting this back to
 * true brings the Share sheet's switch back, and the saved choices with it.
 */
export const MIX_CLIPS_OFFERED = false

/** The choices from the last video made, so sharing again starts where you left off. */
export function loadVideoOptions(): VideoOptions {
  try {
    const raw = localStorage.getItem(VIDEO_OPTIONS_KEY)
    if (!raw) return DEFAULT_VIDEO_OPTIONS
    const saved = JSON.parse(raw) as Partial<VideoOptions> & { v?: number }
    return {
      backgroundId: findVideoBackground(String(saved.backgroundId)).id,
      mix: MIX_CLIPS_OFFERED && saved.v === VIDEO_OPTIONS_VERSION && saved.mix === true,
      quality: isVideoQuality(saved.quality) ? saved.quality : DEFAULT_VIDEO_OPTIONS.quality,
    }
  } catch {
    return DEFAULT_VIDEO_OPTIONS
  }
}

export function saveVideoOptions(options: VideoOptions): void {
  try {
    localStorage.setItem(VIDEO_OPTIONS_KEY, JSON.stringify({ ...options, v: VIDEO_OPTIONS_VERSION }))
  } catch {
    // Remembering is a nicety.
  }
  mixCache = null
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

/** Keeps the chosen quality for the next video, with the rest of the saved choices. */
export function saveVideoQuality(quality: VideoQuality): void {
  saveVideoOptions({ ...loadVideoOptions(), quality })
}

/** Turns cutting between similar clips on or off, keeping the rest of the saved choices. */
export function saveMixClips(mix: boolean): void {
  saveVideoOptions({ ...loadVideoOptions(), mix })
}

// Read once and kept until a choice changes: the swipe view asks on every frame of playback.
let mixCache: boolean | null = null

function subscribeMix(listener: () => void): () => void {
  const changed = () => {
    mixCache = null
    listener()
  }
  window.addEventListener(CHANGED_EVENT, changed)
  window.addEventListener('storage', changed)
  return () => {
    window.removeEventListener(CHANGED_EVENT, changed)
    window.removeEventListener('storage', changed)
  }
}

/**
 * Whether videos cut to similar clips as each ayah starts, in the swipe view
 * and in shared videos alike. Follows a change made anywhere in the app.
 */
export function useMixClips(): boolean {
  return useSyncExternalStore(
    subscribeMix,
    () => (mixCache ??= loadVideoOptions().mix),
    () => DEFAULT_VIDEO_OPTIONS.mix
  )
}
