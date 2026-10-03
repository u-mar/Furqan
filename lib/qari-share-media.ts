/**
 * Turns a recitation into files people can post anywhere: an MP3 of the
 * recording, or a vertical video carrying the app's name and the qari's —
 * made for TikTok, Reels and WhatsApp Status, so every share advertises the app.
 *
 * Recordings are stored as whatever the phone's recorder produced (WebM on
 * Android), which WhatsApp, TikTok and most other apps refuse. A share always
 * converts to MP3 or MP4, which they all accept, and puts the room the
 * recitation was published with back into the sound.
 *
 * Everything runs on the device. The encoder library is loaded only when
 * someone actually shares, so it costs nothing on the feed.
 */

import { APP_ICON_LETTER, APP_NAME } from '@/lib/app-brand'
import { createSpaceMixer, findSpace, type SpaceId } from '@/lib/audio-space'
import { prefetchRecitationAudio, type Recitation } from '@/lib/qari'
import { tr } from '@/lib/i18n-core'
import { loadAyah, viewerTranslation, type AyahView } from '@/lib/qari-ayah'
import { ayahParts, loadPartTranslation } from '@/lib/qari-ayah-parts'
import { getAppSettings } from '@/lib/app-settings'
import { encodeMp3, ensureMp3Encoder, sliceBuffer } from '@/lib/qari-mp3'
import { isRtlTranslationEdition } from '@/lib/translations'
import { findVideoBackground } from '@/lib/qari-backgrounds'

export type ShareKind = 'audio' | 'video'

export interface ShareMedia {
  kind: ShareKind
  blob: Blob
  fileName: string
  mimeType: string
}

export class ShareCancelled extends Error {
  constructor() {
    super('Cancelled')
  }
}

type Progress = (fraction: number) => void

const SAMPLE_RATE = 44100

/** Vertical HD. 720p encodes several times faster than 1080p on a phone and TikTok takes it as is. */
const W = 720
const H = 1280
const FPS = 30

/** True when this browser can make the video at all. Checked before offering it. */
export function canMakeVideo(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ShareCancelled()
}

function fileStem(r: Pick<Recitation, 'title' | 'userName'>): string {
  const stem = `${APP_NAME} - ${r.userName} - ${r.title}`
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stem || APP_NAME
}

/** The recording with its room put back: exactly what a listener hears in the app. */
async function renderRecitationAudio(r: Recitation, signal?: AbortSignal): Promise<AudioBuffer> {
  const blob = await prefetchRecitationAudio(r.id)
  if (!blob || blob.size === 0) throw new Error(tr('Could not download that recitation.'))
  throwIfCancelled(signal)

  // An offline context decodes without ever asking for the speaker.
  const decoder = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  const dry = await decoder.decodeAudioData(await blob.arrayBuffer())
  throwIfCancelled(signal)

  const space = findSpace(r.space as SpaceId)
  const tail = space.wet > 0 ? Math.min(space.seconds, 2.5) : 0
  const ctx = new OfflineAudioContext(2, Math.ceil((dry.duration + tail) * SAMPLE_RATE), SAMPLE_RATE)
  const source = ctx.createBufferSource()
  source.buffer = dry
  const mixer = createSpaceMixer(ctx, source)
  mixer.setSpace(space)
  mixer.output.connect(ctx.destination)
  source.start()
  return ctx.startRendering()
}

export async function makeRecitationAudio(
  r: Recitation,
  onProgress: Progress,
  signal?: AbortSignal
): Promise<ShareMedia> {
  onProgress(0.04)
  const buffer = await renderRecitationAudio(r, signal)
  onProgress(0.25)

  throwIfCancelled(signal)
  const blob = await encodeMp3(buffer, {
    onProgress: (fraction) => onProgress(0.25 + 0.73 * fraction),
    isCancelled: () => Boolean(signal?.aborted),
    onCancel: () => new ShareCancelled(),
  })
  onProgress(1)
  return {
    kind: 'audio',
    blob,
    fileName: `${fileStem(r)}.mp3`,
    mimeType: 'audio/mpeg',
  }
}

/* ------------------------------------------------------------------ video */

/**
 * The look is the swipe view's, so a shared video looks like the recitation
 * does in the app: the recitation's background (drifting slowly, or its clip
 * playing), the same shade over it, the ayah being recited in the mushaf's
 * script with its translation and number, a long ayah a screenful at a time,
 * and the reciter's name and title at the bottom, with the app's mark.
 *
 * Made quickly: everything that does not change from frame to frame (the
 * shade, each part of each ayah, the name) is drawn once and stamped onto
 * each frame, and a moving background is decoded straight through rather
 * than seeked to frame by frame.
 */

export {
  FEATURED_VIDEO_BACKGROUND_IDS,
  VIDEO_BACKGROUND_GROUPS,
  VIDEO_BACKGROUNDS,
  findVideoBackground,
  type VideoBackground,
} from '@/lib/qari-backgrounds'

export interface VideoOptions {
  /** One of VIDEO_BACKGROUNDS' ids. */
  backgroundId: string
  /** Off leaves the reciter's picture out. */
  includeAvatar: boolean
}

export const DEFAULT_VIDEO_OPTIONS: VideoOptions = {
  backgroundId: 'black',
  includeAvatar: true,
}

const VIDEO_OPTIONS_KEY = 'muyassar_qari_video_options'

/** The choices from the last video made, so sharing again starts where you left off. */
export function loadVideoOptions(): VideoOptions {
  try {
    const raw = localStorage.getItem(VIDEO_OPTIONS_KEY)
    if (!raw) return DEFAULT_VIDEO_OPTIONS
    const saved = JSON.parse(raw) as Partial<VideoOptions>
    return {
      backgroundId: findVideoBackground(String(saved.backgroundId)).id,
      includeAvatar: saved.includeAvatar !== false,
    }
  } catch {
    return DEFAULT_VIDEO_OPTIONS
  }
}

export function saveVideoOptions(options: VideoOptions): void {
  try {
    localStorage.setItem(VIDEO_OPTIONS_KEY, JSON.stringify(options))
  } catch {
    // Remembering is a nicety.
  }
}

/** The swipe view is laid out for a 375-point-wide phone; the video is that, scaled up. */
const S = W / 375

const IVORY = '#f3ead6'
const GOLD = '#d9b86a'

/** Where the ayah sits: centred a little above the middle, as in the swipe view, clear of the name below. */
const CAPTION_CENTER_Y = Math.round(H * 0.44)
const CAPTION_MAX_HEIGHT = Math.round(H * 0.56)
const CAPTION_WIDTH = W - Math.round(28 * S) * 2

const AVATAR_SIZE = Math.round(44 * S)
const FOOTER_LEFT = Math.round(16 * S)
const FOOTER_BOTTOM = H - Math.round(40 * S)

/** One screenful: an ayah (or part of a long one) with its translation and number, drawn once. */
interface Caption {
  /** Shown from here until the next one starts. */
  atSeconds: number
  image: HTMLCanvasElement
}

interface Scene {
  /** A still background, drawn larger than the frame so it can drift. null for plain black or a clip. */
  still: HTMLCanvasElement | null
  /** The moving background's frames, one per video frame, already the frame's size. */
  clip: AsyncGenerator<CanvasImageSource | null> | null
  /** The shade over the background, and the soft black when there is none. */
  shade: HTMLCanvasElement
  captions: Caption[]
  /** Shown when no ayat were marked: the title, as the swipe view does. */
  titleCard: HTMLCanvasElement | null
  footer: HTMLCanvasElement
  /** The app's mark and name, top left. */
  brand: HTMLCanvasElement
  avatar: HTMLCanvasElement | null
  /** Overall loudness per frame, 0–1, for the ring around the picture. */
  level: Float32Array
  frames: number
  seconds: number
}

function cssFont(varName: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value ? `${value}, ${fallback}` : fallback
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function makeCanvas(width = W, height = H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(tr('Could not draw the video on this device.'))
  return [canvas, ctx]
}

function wrapLines(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(candidate).width <= maxWidth) line = candidate
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

interface FittedBlock {
  lines: string[]
  font: string
  lineHeight: number
  height: number
}

/** Wraps `words` at `size`, shrinking until the block is no taller than `maxHeight`. */
function fitBlock(
  ctx: CanvasRenderingContext2D,
  words: string[],
  opts: { family: string; weight?: string; maxWidth: number; maxHeight: number; size: number; minSize: number; lineHeightRatio: number }
): FittedBlock {
  let size = opts.size
  for (;;) {
    const font = `${opts.weight ?? ''} ${size}px ${opts.family}`.trim()
    ctx.font = font
    const lines = wrapLines(ctx, words, opts.maxWidth)
    const lineHeight = size * opts.lineHeightRatio
    if (lines.length * lineHeight <= opts.maxHeight || size <= opts.minSize) {
      return { lines, font, lineHeight, height: lines.length * lineHeight }
    }
    size = Math.max(opts.minSize, size - 2)
  }
}

/** The phrase's type, as in the swipe view: as large as this, and only as small as that before it takes two lines. */
const LINE_MAX = Math.round(32 * S)
const LINE_MIN = Math.round(21 * S)

function withShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
  ctx.shadowBlur = 16 * S
  ctx.shadowOffsetY = 2 * S
}

/** A phrase of an ayah as the swipe view draws it, one line with its translation under it, on a canvas of its own. */
function drawCaption(opts: {
  words: string[]
  arabicFont: string
  arabicWeight: string
  translation: string | null
  translationFont: string
  translationRtl: boolean
}): HTMLCanvasElement {
  const [, measure] = makeCanvas(10, 10)
  // On one line, as large as fits; a phrase too long even at the smallest size takes two.
  let size = LINE_MAX
  const text = opts.words.join(' ')
  for (; size > LINE_MIN; size -= 2) {
    measure.font = `${opts.arabicWeight} ${size}px ${opts.arabicFont}`.trim()
    if (measure.measureText(text).width <= CAPTION_WIDTH) break
  }
  const arabic = fitBlock(measure, opts.words, {
    family: opts.arabicFont,
    weight: opts.arabicWeight,
    maxWidth: CAPTION_WIDTH,
    maxHeight: CAPTION_MAX_HEIGHT * 0.5,
    size,
    minSize: LINE_MIN,
    lineHeightRatio: 1.9,
  })
  const translation = opts.translation
    ? fitBlock(measure, opts.translation.split(/\s+/), {
        family: opts.translationFont,
        maxWidth: Math.min(CAPTION_WIDTH, Math.round(300 * S)),
        maxHeight: CAPTION_MAX_HEIGHT * 0.3,
        size: Math.round((opts.translationRtl ? 17 : 14.5) * S),
        minSize: Math.round(11 * S),
        lineHeightRatio: 1.6,
      })
    : null
  const gap = Math.round(8 * S)
  const pad = Math.round(24 * S)
  const height = pad + arabic.height + (translation ? gap + translation.height : 0) + pad

  const [canvas, ctx] = makeCanvas(W, Math.ceil(height))
  ctx.textAlign = 'center'
  withShadow(ctx)
  let y = pad

  ctx.direction = 'rtl'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = IVORY
  ctx.font = arabic.font
  for (const line of arabic.lines) {
    ctx.fillText(line, W / 2, y + arabic.lineHeight / 2)
    y += arabic.lineHeight
  }

  if (translation) {
    y += gap
    ctx.direction = opts.translationRtl ? 'rtl' : 'ltr'
    ctx.fillStyle = 'rgba(243, 234, 214, 0.88)'
    ctx.font = translation.font
    for (const line of translation.lines) {
      ctx.fillText(line, W / 2, y + translation.lineHeight / 2)
      y += translation.lineHeight
    }
  }
  return canvas
}

/** Every phrase of the recitation, in order: each ayah cut where the mushaf pauses. */
async function prepareCaptions(r: Recitation, translationFont: string, translationRtl: boolean): Promise<Caption[]> {
  const timeline = [...(r.verseTimeline ?? [])].sort((a, b) => a.atSeconds - b.atSeconds)
  if (!timeline.length) return []
  // In the language of whoever is sharing it: the translation they read the Quran with.
  const edition = viewerTranslation(getAppSettings().translationEditionId)
  const views = new Map<string, AyahView | null>()
  await Promise.all([...new Set(timeline.map((e) => e.verseKey))].map(async (key) => views.set(key, await loadAyah(key, edition))))

  const captions = await Promise.all(
    timeline.map(async (entry, i): Promise<Caption[]> => {
      const view = views.get(entry.verseKey)
      if (!view) return []
      const parts = ayahParts(view.pauseAfter)
      const endsAt = timeline[i + 1]?.atSeconds ?? r.durationSec
      const texts =
        parts.length > 1 ? await Promise.all(parts.map((part) => loadPartTranslation(view.verseKey, edition, part))) : [view.translation]
      return parts.map((part, k) => ({
        // A part starts with its first word: when it was heard, or its share of the ayah's time.
        atSeconds:
          k === 0
            ? entry.atSeconds
            : (entry.words?.[part.start] ?? entry.atSeconds + (part.start / view.words.length) * (endsAt - entry.atSeconds)),
        image: drawCaption({
          // The last phrase ends with the ayah's ornament and its number.
          words: [...view.words.slice(part.start, part.end + 1), ...(k === parts.length - 1 && view.endMark ? [view.endMark] : [])],
          arabicFont: view.fontFamily,
          // The mushaf's glyph font has no bold face; Amiri, its stand-in, reads better bold.
          arabicWeight: view.qcf ? '' : '700',
          translation: texts[k] ?? null,
          translationFont,
          translationRtl,
        }),
      }))
    })
  )
  return captions.flat().sort((a, b) => a.atSeconds - b.atSeconds)
}

/** The title, with the swipe view's ornament above it, for a recitation without marked ayat. */
function drawTitleCard(title: string, serif: string): HTMLCanvasElement {
  const [, measure] = makeCanvas(10, 10)
  const block = fitBlock(measure, title.split(/\s+/), {
    family: serif,
    weight: '500',
    maxWidth: CAPTION_WIDTH,
    maxHeight: 4 * 30 * S * 1.2,
    size: Math.round(30 * S),
    minSize: Math.round(20 * S),
    lineHeightRatio: 1.2,
  })
  const lines = block.lines.slice(0, 4)
  const icon = Math.round(56 * S)
  const gap = Math.round(16 * S)
  const [canvas, ctx] = makeCanvas(W, Math.ceil(icon + gap + lines.length * block.lineHeight + 40))

  // The square, the diamond and the circle, in gold.
  const cx = W / 2
  const cy = icon / 2
  const unit = icon / 64
  ctx.strokeStyle = GOLD
  ctx.globalAlpha = 0.8
  ctx.lineWidth = 1.2 * unit * 1.6
  ctx.strokeRect(cx - 14 * unit, cy - 14 * unit, 28 * unit, 28 * unit)
  ctx.beginPath()
  ctx.moveTo(cx, cy - 24 * unit)
  ctx.lineTo(cx + 24 * unit, cy)
  ctx.lineTo(cx, cy + 24 * unit)
  ctx.lineTo(cx - 24 * unit, cy)
  ctx.closePath()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, 5 * unit, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 1

  withShadow(ctx)
  ctx.fillStyle = IVORY
  ctx.font = block.font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let y = icon + gap
  for (const line of lines) {
    ctx.fillText(line, W / 2, y + block.lineHeight / 2)
    y += block.lineHeight
  }
  return canvas
}

/** The swipe view's shade: darker at the top and bottom so the text there reads, and the soft black when there is no picture. */
function drawShade(hasPicture: boolean): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas()
  if (!hasPicture) {
    const glow = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.38, H * 0.75)
    glow.addColorStop(0, '#232323')
    glow.addColorStop(1, '#060606')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
  }
  const shade = ctx.createLinearGradient(0, 0, 0, H)
  shade.addColorStop(0, 'rgba(0, 0, 0, 0.6)')
  shade.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)')
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)
  // The faint mist that drifts over the swipe view, held still.
  for (const [x, y, rx, a] of [
    [0.3, 0.4, 0.4, 0.11],
    [0.72, 0.62, 0.35, 0.08],
  ] as const) {
    const mist = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, W * rx * 1.6)
    mist.addColorStop(0, `rgba(243, 234, 214, ${a})`)
    mist.addColorStop(1, 'rgba(243, 234, 214, 0)')
    ctx.fillStyle = mist
    ctx.fillRect(0, 0, W, H)
  }
  return canvas
}

/** @username and the title, bottom left, as on the swipe view; room is left for the picture when it is shown. */
function drawFooter(r: Recitation, serif: string, sans: string, withAvatar: boolean): HTMLCanvasElement {
  const height = Math.round(64 * S)
  const [canvas, ctx] = makeCanvas(W, height)
  const x = FOOTER_LEFT + (withAvatar ? AVATAR_SIZE + Math.round(12 * S) : 0)
  const maxWidth = W - x - FOOTER_LEFT
  const fit = (text: string) => {
    let shown = text
    while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) shown = shown.slice(0, -1)
    return shown === text ? text : `${shown.trimEnd()}…`
  }
  withShadow(ctx)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `600 ${Math.round(17 * S)}px ${sans}`
  ctx.fillText(fit(`@${r.userUsername}`), x, height * 0.3)
  ctx.font = `500 ${Math.round(16 * S)}px ${serif}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.fillText(fit(r.title), x, height * 0.72)
  return canvas
}

/** The app's mark and name, top left, where the swipe view has its tabs. */
function drawBrand(serif: string): HTMLCanvasElement {
  const mark = Math.round(26 * S)
  const [canvas, ctx] = makeCanvas(Math.round(220 * S), mark + 8)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(2, 2, mark, mark, mark * 0.24)
  ctx.fillStyle = '#000000'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.stroke()
  ctx.fillStyle = '#f5ecd8'
  ctx.font = `700 ${Math.round(mark * 0.62)}px ${serif}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(APP_ICON_LETTER, 2 + mark / 2, 2 + mark / 2 + mark * 0.04)
  ctx.restore()
  withShadow(ctx)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.font = `700 ${Math.round(15 * S)}px ${serif}`
  ctx.textBaseline = 'middle'
  ctx.fillText(`${APP_NAME} App`, mark + Math.round(10 * S), 2 + mark / 2)
  return canvas
}

function drawAvatar(r: Recitation, picture: HTMLImageElement | null, serif: string): HTMLCanvasElement {
  const size = AVATAR_SIZE
  const [canvas, ctx] = makeCanvas(size, size)
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (picture) {
    const scale = Math.max(size / picture.naturalWidth, size / picture.naturalHeight)
    const dw = picture.naturalWidth * scale
    const dh = picture.naturalHeight * scale
    ctx.drawImage(picture, (size - dw) / 2, (size - dh) / 2, dw, dh)
  } else {
    const fill = ctx.createLinearGradient(0, 0, size, size)
    fill.addColorStop(0, '#4a86ad')
    fill.addColorStop(1, '#16324f')
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 ${Math.round(size * 0.45)}px ${serif}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((r.userName || r.userUsername || '?').trim().charAt(0).toUpperCase(), size / 2, size / 2 + 2)
  }
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
  ctx.stroke()
  return canvas
}

/** A still background drawn once, a little larger than the frame, so drifting over it never shows an edge. */
const DRIFT_SCALE = 1.2

function drawStill(picture: HTMLImageElement): HTMLCanvasElement {
  const width = Math.round(W * DRIFT_SCALE)
  const height = Math.round(H * DRIFT_SCALE)
  const [canvas, ctx] = makeCanvas(width, height)
  const scale = Math.max(width / picture.naturalWidth, height / picture.naturalHeight)
  const dw = picture.naturalWidth * scale
  const dh = picture.naturalHeight * scale
  ctx.drawImage(picture, (width - dw) / 2, (height - dh) / 2, dw, dh)
  return canvas
}

type Mediabunny = typeof import('mediabunny')

/** A copy of a Cloudinary clip already the video's shape and size, so far less has to be decoded. */
function clipAtVideoSize(url: string): string {
  return url.includes('/video/upload/') ? url.replace('/video/upload/', `/video/upload/w_${W},h_${H},c_fill,q_auto/`) : url
}

/**
 * The moving background's frames for a video `frames` long, in order and the
 * frame's size, looped under a recitation longer than the clip. Decoded
 * straight through, which is many times faster than seeking to each frame.
 */
async function openClip(mb: Mediabunny, url: string, frames: number): Promise<AsyncGenerator<CanvasImageSource | null> | null> {
  for (const src of [clipAtVideoSize(url), url]) {
    try {
      const input = new mb.Input({ source: new mb.UrlSource(src), formats: mb.ALL_FORMATS })
      const track = await input.getPrimaryVideoTrack()
      if (!track || !(await track.canDecode())) continue
      const duration = await track.computeDuration()
      if (!(duration > 0.5)) continue
      const sink = new mb.CanvasSink(track, { width: W, height: H, fit: 'cover', poolSize: 3 })
      return (async function* () {
        let i = 0
        while (i < frames) {
          const loopStart = Math.floor(i / FPS / duration) * duration
          const times: number[] = []
          while (i < frames && i / FPS < loopStart + duration) {
            times.push(Math.min(i / FPS - loopStart, duration - 1 / FPS))
            i += 1
          }
          for await (const wrapped of sink.canvasesAtTimestamps(times)) yield wrapped?.canvas ?? null
        }
      })()
    } catch {
      // Try the full-size clip, then no clip at all.
    }
  }
  return null
}

/**
 * Listen to the whole recitation once, frame by frame, for how loud it is —
 * for the ring that breathes around the reciter's picture.
 */
function analyse(buffer: AudioBuffer): { level: Float32Array; frames: number } {
  const data = buffer.getChannelData(0)
  const frames = Math.max(1, Math.ceil(buffer.duration * FPS))
  const windowSamples = Math.round(buffer.sampleRate / FPS)

  const loud = new Float32Array(frames)
  for (let f = 0; f < frames; f += 1) {
    const start = Math.floor((f / FPS) * buffer.sampleRate) - windowSamples / 2
    let energy = 0
    for (let i = 0; i < windowSamples; i += 1) {
      const index = start + i
      const sample = index >= 0 && index < data.length ? data[index] : 0
      energy += sample * sample
    }
    loud[f] = Math.sqrt(energy / windowSamples)
  }

  const sortedLoud = Float32Array.from(loud).sort()
  const loudCeiling = sortedLoud[Math.floor(sortedLoud.length * 0.97)] || 1e-6

  const level = new Float32Array(frames)
  let heldLevel = 0
  for (let f = 0; f < frames; f += 1) {
    const targetLevel = Math.min(1, Math.pow(loud[f] / loudCeiling, 0.7))
    heldLevel += (targetLevel - heldLevel) * (targetLevel > heldLevel ? 0.5 : 0.16)
    level[f] = heldLevel
  }

  return { level, frames }
}

async function prepareScene(mb: Mediabunny, r: Recitation, buffer: AudioBuffer, options: VideoOptions): Promise<Scene> {
  const serif = cssFont('--font-home-serif', "'Fraunces', Georgia, serif")
  const sans = cssFont('--font-sans', 'system-ui, sans-serif')
  const amiri = cssFont('--font-amiri', "'Amiri', serif")
  const background = findVideoBackground(options.backgroundId)
  const edition = viewerTranslation(getAppSettings().translationEditionId)
  const translationRtl = isRtlTranslationEdition(edition)
  // Fraunces has no Arabic-script letters, so Urdu, Persian and the like are set in Amiri.
  const translationFont = translationRtl ? amiri : serif
  const { level, frames } = analyse(buffer)

  const [picture, still, clip, captions] = await Promise.all([
    options.includeAvatar ? loadImage(`/api/qari/avatar/${encodeURIComponent(r.userUsername.toLowerCase())}`) : null,
    !background.videoUrl && background.url ? loadImage(background.url) : null,
    background.videoUrl ? openClip(mb, background.videoUrl, frames) : null,
    prepareCaptions(r, translationFont, translationRtl),
    document.fonts
      ? Promise.all([
          document.fonts.load(`700 30px ${serif}`, APP_ICON_LETTER),
          document.fonts.load(`500 30px ${serif}`, r.title),
          document.fonts.load(`600 30px ${sans}`, r.userUsername),
          document.fonts.load(`700 30px ${amiri}`, 'ا'),
        ]).catch(() => null)
      : null,
  ])

  // A clip that cannot be read stands still on its poster frame instead.
  const fallback = background.videoUrl && !clip && background.url ? await loadImage(background.url) : null
  const picturePresent = Boolean(still || clip || fallback)

  return {
    still: still ? drawStill(still) : fallback ? drawStill(fallback) : null,
    clip,
    shade: drawShade(picturePresent),
    captions,
    titleCard: captions.length ? null : drawTitleCard(r.title, serif),
    footer: drawFooter(r, serif, sans, options.includeAvatar),
    brand: drawBrand(serif),
    avatar: options.includeAvatar ? drawAvatar(r, picture, serif) : null,
    level,
    frames,
    seconds: buffer.duration,
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, t: number, clipFrame: CanvasImageSource | null) {
  ctx.fillStyle = '#070707'
  ctx.fillRect(0, 0, W, H)

  if (clipFrame) {
    ctx.drawImage(clipFrame, 0, 0, W, H)
  } else if (scene.still) {
    // The swipe view's slow drift: in a little and across, and back, every 26 seconds.
    const phase = (1 - Math.cos((t / 26) * Math.PI)) / 2
    const zoom = 1.08 + 0.12 * phase
    const dw = W * zoom
    const dh = H * zoom
    const x = (W - dw) / 2 + (-0.015 + 0.03 * phase) * W
    const y = (H - dh) / 2 + (-0.01 + 0.02 * phase) * H
    ctx.drawImage(scene.still, x, y, dw, dh)
  }
  ctx.drawImage(scene.shade, 0, 0)

  ctx.drawImage(scene.brand, FOOTER_LEFT, Math.round(22 * S))

  // The ayah (or part) being recited: the last one whose time has come, held until the next.
  let caption: Caption | null = null
  for (const c of scene.captions) {
    if (c.atSeconds > t) break
    caption = c
  }
  if (!caption && scene.captions.length) caption = scene.captions[0]
  const block = caption?.image ?? scene.titleCard
  if (block) {
    // Each new screenful fades in, as in the swipe view.
    const since = caption ? t - caption.atSeconds : t
    ctx.globalAlpha = Math.max(0, Math.min(1, since / 0.35))
    ctx.drawImage(block, 0, Math.round(CAPTION_CENTER_Y - block.height / 2))
    ctx.globalAlpha = 1
  }

  const footerTop = FOOTER_BOTTOM - scene.footer.height
  ctx.drawImage(scene.footer, 0, footerTop)
  if (scene.avatar) {
    const f = Math.max(0, Math.min(scene.frames - 1, Math.floor(t * FPS)))
    const level = scene.level[f] ?? 0
    const r = AVATAR_SIZE / 2
    const cx = FOOTER_LEFT + r
    const cy = footerTop + scene.footer.height / 2
    // A soft ring breathing out from the picture with the voice.
    ctx.save()
    ctx.strokeStyle = '#ffffff'
    ctx.globalAlpha = 0.12 + level * 0.3
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r + 6 + level * 9, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
    ctx.drawImage(scene.avatar, cx - r, cy - r)
  }

  // In from black, and out again over the last moments of the tail.
  const fade = Math.min(1, t / 0.4, (scene.seconds - t) / 0.7)
  if (fade < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, 1 - Math.max(0, fade))})`
    ctx.fillRect(0, 0, W, H)
  }
}

export async function makeRecitationVideo(
  r: Recitation,
  onProgress: Progress,
  signal?: AbortSignal,
  options: VideoOptions = DEFAULT_VIDEO_OPTIONS
): Promise<ShareMedia> {
  onProgress(0.02)
  const mb = await import('mediabunny')
  const [buffer, canVideo, canAac] = await Promise.all([
    renderRecitationAudio(r, signal),
    mb.canEncodeVideo('avc', { width: W, height: H }),
    mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE }),
  ])
  if (!canVideo) throw new Error(tr('This browser cannot make videos yet. Update it, or share the audio instead.'))
  // AAC is what every app expects inside an MP4. Where the browser has no AAC
  // encoder, MP3 inside the MP4 plays just as widely.
  const audioCodec: 'aac' | 'mp3' = canAac ? 'aac' : 'mp3'
  if (!canAac) await ensureMp3Encoder()
  onProgress(0.08)
  throwIfCancelled(signal)

  const scene = await prepareScene(mb, r, buffer, options)
  onProgress(0.12)
  throwIfCancelled(signal)

  const [canvas, ctx] = makeCanvas()
  const output = new mb.Output({
    format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new mb.BufferTarget(),
  })
  const video = new mb.CanvasSource(canvas, { codec: 'avc', quality: mb.QUALITY_HIGH, keyFrameInterval: 2 })
  output.addVideoTrack(video, { frameRate: FPS })
  const audio = new mb.AudioBufferSource({ codec: audioCodec, quality: mb.QUALITY_HIGH })
  output.addAudioTrack(audio)
  await output.start()

  const totalFrames = scene.frames
  const audioChunk = buffer.sampleRate
  let audioCursor = 0
  let clipFrame: CanvasImageSource | null = null

  try {
    for (let i = 0; i < totalFrames; i += 1) {
      throwIfCancelled(signal)
      const t = i / FPS
      if (scene.clip) {
        const next = await scene.clip.next()
        // A frame that did not decode keeps the one before it.
        if (!next.done && next.value) clipFrame = next.value
      }
      drawFrame(ctx, scene, t, clipFrame)
      await video.add(t, 1 / FPS)

      // Audio is fed alongside the frames so the file interleaves as it is written.
      while (audioCursor < buffer.length && audioCursor / buffer.sampleRate <= t + 1) {
        const end = Math.min(buffer.length, audioCursor + audioChunk)
        await audio.add(sliceBuffer(buffer, audioCursor, end))
        audioCursor = end
      }
      if (i % 6 === 0) onProgress(0.12 + 0.86 * (i / totalFrames))
    }
    while (audioCursor < buffer.length) {
      const end = Math.min(buffer.length, audioCursor + audioChunk)
      await audio.add(sliceBuffer(buffer, audioCursor, end))
      audioCursor = end
    }
    await output.finalize()
  } catch (err) {
    if (output.state !== 'finalized') await output.cancel().catch(() => {})
    throw err
  } finally {
    void scene.clip?.return(undefined)
  }

  const data = output.target.buffer
  if (!data) throw new Error(tr('Could not make the video.'))
  onProgress(1)
  return {
    kind: 'video',
    blob: new Blob([data], { type: 'video/mp4' }),
    fileName: `${fileStem(r)}.mp4`,
    mimeType: 'video/mp4',
  }
}

/* ------------------------------------------------------------ handing over */

export function recitationLink(r: Pick<Recitation, 'id' | 'userUsername'>): string {
  return `${window.location.origin}/qari/${encodeURIComponent(r.userUsername)}?r=${r.id}`
}

export function canShareMedia(media: ShareMedia): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false
  try {
    return navigator.canShare({ files: [new File([media.blob], media.fileName, { type: media.mimeType })] })
  } catch {
    return false
  }
}

/**
 * Hand the file to the phone's share sheet. Call this straight from a tap:
 * phones only open the sheet inside a fresh gesture, which is why making the
 * file and sharing it are two separate steps.
 */
export async function shareMedia(media: ShareMedia, r: Recitation): Promise<'shared' | 'saved'> {
  const file = new File([media.blob], media.fileName, { type: media.mimeType })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${r.userName} — ${r.title}`,
        text: `${r.userName} — ${r.title}\n${recitationLink(r)}`,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
      throw err
    }
  }
  saveMedia(media)
  return 'saved'
}

/** Download the file to the device, for uploading from the gallery or files later. */
export function saveMedia(media: ShareMedia): void {
  const url = URL.createObjectURL(media.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = media.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Clipboard access needs a secure page; the old copy command still works everywhere else. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the old way.
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  field.remove()
  return ok
}
