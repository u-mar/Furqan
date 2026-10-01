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
import { loadPageFont, qcfPageFontFamily } from '@/lib/mushaf-fonts'
import { prefetchRecitationAudio, type Recitation } from '@/lib/qari'
import { tr } from '@/lib/i18n-core'
import { fetchPageTranslations, verseQcfWords, viewerTranslation } from '@/lib/qari-ayah'
import { getAppSettings } from '@/lib/app-settings'
import { encodeMp3, ensureMp3Encoder, sliceBuffer } from '@/lib/qari-mp3'
import { pageHasQcfData, versePageNumber } from '@/lib/qcf-page'
import { getVerseArabicText } from '@/lib/quran-display'
import { getVerseByKey } from '@/lib/quran'
import { isRtlTranslationEdition } from '@/lib/translations'
import { findVideoBackground } from '@/lib/qari-backgrounds'
import type { Verse } from '@/types'

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
 * The look: a plain black or a chosen photo behind, the reciter's picture
 * small in the middle (optional), a waveform that follows the voice's own
 * frequencies, and the app's mark with the reciter's name under it in the
 * corner. Nothing else.
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
  /** Off skips the reciter's picture (and its ring) entirely. */
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

// Low, centred, and clear of the badge at the very bottom — the ayah and its
// translation take the whole middle of the frame now that there's no
// waveform to share it with.
const AVATAR_Y = 1050
const AVATAR_SIZE = 148

const CAPTION_TOP = 380
const CAPTION_BOTTOM = 900
const CAPTION_SIDE_MARGIN = 70

interface FittedBlock {
  lines: string[]
  fontSize: number
  lineHeight: number
  height: number
}

interface CaptionBlock {
  /** The recording's own clock — shown from here until the next one starts. */
  atSeconds: number
  arabic: FittedBlock
  /** The page's own QCF glyph font — the same script the mushaf itself uses.
   *  Falls back to Amiri when the ayah has no QCF data or its font won't load. */
  arabicFont: string
  /** '' for QCF (a PUA-glyph font with no real bold face — forcing one would
   *  synthesize-bold the letterforms out of shape), '700' for the Amiri fallback. */
  arabicWeight: string
  /** null when no translation could be found for this ayah. */
  translation: FittedBlock | null
  /** Both blocks' combined height, for centring the pair as one group. */
  groupHeight: number
}

interface Scene {
  /** null when the plain black background — or a moving one — was chosen. */
  background: HTMLImageElement | null
  /** Set instead of `background` for a moving clip; looped to the recitation's length. */
  backgroundVideo: HTMLVideoElement | null
  /** `backgroundVideo`'s own length, for looping it under a longer recitation. 0 when there is none. */
  backgroundVideoDuration: number
  /** null when the reciter's picture was left out. */
  avatar: HTMLCanvasElement | null
  badge: HTMLCanvasElement
  /** The ayah text (and its translation), one block per verse marked while
   *  recording — empty when the reciter never opened the Mushaf overlay (or
   *  never tapped an ayah). */
  captions: CaptionBlock[]
  translationFont: string
  /** The translation reads right to left (Urdu, Persian…). */
  translationRtl: boolean
  /** Overall loudness per frame, 0–1 — still used for the avatar's breathing ring. */
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
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Loaded muted and never played — frames are pulled out one at a time by
 * seeking (see `seekVideoTo`), since the export runs frame-by-frame rather
 * than in real time. `crossOrigin` is required for a cross-origin video to
 * stay drawable on canvas; Cloudinary sends the CORS header this needs.
 */
function loadVideo(src: string): Promise<HTMLVideoElement | null> {
  return new Promise((resolve) => {
    const el = document.createElement('video')
    el.crossOrigin = 'anonymous'
    el.muted = true
    el.playsInline = true
    el.preload = 'auto'
    el.onloadedmetadata = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = src
  })
}

/** Resolves once the frame at `time` has actually decoded and is drawable. */
function seekVideoTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

function mediaSize(el: HTMLImageElement | HTMLVideoElement): { w: number; h: number } {
  return el instanceof HTMLVideoElement
    ? { w: el.videoWidth, h: el.videoHeight }
    : { w: el.naturalWidth, h: el.naturalHeight }
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

/** Shrinks the type until the wrapped block fits the space it's given — the
 *  same approach the verse-image share cards use, done once per marked ayah
 *  (and its translation) rather than on every frame. */
function fitBlock(
  ctx: CanvasRenderingContext2D,
  words: string[],
  opts: { fontStack: string; weight?: string; maxWidth: number; maxHeight: number; startSize: number; minSize: number; lineHeightRatio: number }
): FittedBlock {
  const { fontStack, weight = '', maxWidth, maxHeight, startSize, minSize, lineHeightRatio } = opts
  let fontSize = startSize
  let lines: string[] = []
  let lineHeight = fontSize * lineHeightRatio
  while (fontSize >= minSize) {
    ctx.font = `${weight} ${fontSize}px ${fontStack}`.trim()
    lines = wrapLines(ctx, words, maxWidth)
    lineHeight = fontSize * lineHeightRatio
    if (lines.length * lineHeight <= maxHeight) break
    fontSize -= 2
  }
  return { lines, fontSize, lineHeight, height: lines.length * lineHeight }
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, serif: string) {
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, size * 0.24)
  ctx.fillStyle = '#000000'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  ctx.stroke()
  ctx.fillStyle = '#f5ecd8'
  ctx.font = `700 ${Math.round(size * 0.62)}px ${serif}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(APP_ICON_LETTER, x + size / 2, y + size / 2 + size * 0.04)
  ctx.restore()
}

/**
 * Listen to the whole recitation once, frame by frame, for how loud it is —
 * used only for the avatar's breathing ring now that the waveform is gone.
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

async function prepareScene(r: Recitation, buffer: AudioBuffer, options: VideoOptions): Promise<Scene> {
  const serif = cssFont('--font-home-serif', "'Fraunces', Georgia, serif")
  const sans = cssFont('--font-sans', 'system-ui, sans-serif')
  const arabicFont = cssFont('--font-amiri', "'Amiri', serif")
  const background = findVideoBackground(options.backgroundId)
  // In the language of whoever is sharing it: the translation they read the Quran with.
  const edition = viewerTranslation(getAppSettings().translationEditionId)
  const translationRtl = isRtlTranslationEdition(edition)
  // Fraunces has no Arabic-script letters, so Urdu, Persian and the like are set in Amiri.
  const translationFont = translationRtl ? arabicFont : serif

  const [picture, backgroundImage, backgroundVideo] = await Promise.all([
    options.includeAvatar
      ? loadImage(`/api/qari/avatar/${encodeURIComponent(r.userUsername.toLowerCase())}`)
      : null,
    // A moving background's `url` is only its Cloudinary-derived poster frame,
    // used by the picker's thumbnail — the actual export always pulls frames
    // from `videoUrl` instead, so it's skipped here.
    !background.videoUrl && background.url ? loadImage(background.url) : null,
    background.videoUrl ? loadVideo(background.videoUrl) : null,
    document.fonts
      ? Promise.all([
          document.fonts.load(`700 30px ${serif}`, APP_ICON_LETTER),
          document.fonts.load(`600 30px ${sans}`, r.userName),
          document.fonts.load(`700 30px ${arabicFont}`, 'ا'),
        ]).catch(() => null)
      : null,
  ])

  // The ayat marked while reading from the Mushaf — one verse (and one
  // translation) lookup per unique verse, then wrapped/sized once each
  // rather than on every frame.
  const timeline = [...(r.verseTimeline ?? [])].sort((a, b) => a.atSeconds - b.atSeconds)
  let captions: CaptionBlock[] = []
  if (timeline.length) {
    const uniqueKeys = [...new Set(timeline.map((entry) => entry.verseKey))]
    const verses = new Map<string, Verse>()
    await Promise.all(
      uniqueKeys.map(async (verseKey) => {
        try {
          verses.set(verseKey, await getVerseByKey(verseKey))
        } catch {
          // An ayah that fails to resolve just has no caption of its own —
          // the previous one keeps showing instead of breaking the export.
        }
      })
    )

    // One translation fetch per page these ayat actually fall on, not one per ayah.
    const pagesNeeded = new Set([...verses.values()].map((v) => versePageNumber(v)))
    const translationsByPage = new Map<number, Map<string, string>>()
    await Promise.all(
      [...pagesNeeded].map(async (page) => translationsByPage.set(page, await fetchPageTranslations(page, edition)))
    )

    const [, measureCtx] = makeCanvas(10, 10)
    const arabicMaxHeight = (CAPTION_BOTTOM - CAPTION_TOP) * 0.62
    const translationMaxHeight = (CAPTION_BOTTOM - CAPTION_TOP) * 0.3

    captions = (
      await Promise.all(
        timeline.map(async (entry): Promise<CaptionBlock | null> => {
          const verse = verses.get(entry.verseKey)
          if (!verse) return null
          const page = versePageNumber(verse)

          // The mushaf's own script when this ayah has QCF data for its page
          // and the page's glyph font actually loads; plain Uthmani otherwise.
          const qcfWords = pageHasQcfData([verse]) ? verseQcfWords(verse, page) : []
          const fontFamily = qcfPageFontFamily(page)
          const fontLoaded = qcfWords.length > 0 && (await loadPageFont(page, qcfWords.join('').slice(0, 12)))
          const words = fontLoaded ? qcfWords : getVerseArabicText(verse, { omitEndMark: true }).split(/\s+/)
          const font = fontLoaded ? `"${fontFamily}"` : arabicFont

          const arabic = fitBlock(measureCtx, words, {
            fontStack: font,
            // QCF is a PUA-glyph font shaped for the printed Madani mushaf,
            // never designed with a bold face — forcing weight 700 makes the
            // browser synthesize bold by thickening strokes, which distorts
            // the letterforms into something that no longer reads as the
            // real mushaf script. The mushaf reader itself never bolds it
            // either. Amiri (the fallback when a page has no QCF data) does
            // have a real bold face, so it still gets one.
            weight: fontLoaded ? '' : '700',
            maxWidth: W - CAPTION_SIDE_MARGIN * 2,
            maxHeight: arabicMaxHeight,
            startSize: 64,
            minSize: 30,
            lineHeightRatio: 1.7,
          })

          const translationText = translationsByPage.get(page)?.get(entry.verseKey)?.replace(/\s+/g, ' ').trim()
          const translation = translationText
            ? fitBlock(measureCtx, translationText.split(/\s+/), {
                fontStack: translationFont,
                weight: '500',
                maxWidth: W - CAPTION_SIDE_MARGIN * 2 - 40,
                maxHeight: translationMaxHeight,
                startSize: 30,
                minSize: 18,
                lineHeightRatio: 1.5,
              })
            : null

          return {
            atSeconds: entry.atSeconds,
            arabic,
            arabicFont: font,
            arabicWeight: fontLoaded ? '' : '700',
            translation,
            groupHeight: arabic.height + (translation ? 56 + translation.height : 0),
          }
        })
      )
    ).filter((c): c is CaptionBlock => c !== null)
  }

  /* The picture, small and round; the initial on deep blue when there is none */
  let avatar: HTMLCanvasElement | null = null
  if (options.includeAvatar) {
    const [avatarCanvas, actx] = makeCanvas(AVATAR_SIZE, AVATAR_SIZE)
    actx.beginPath()
    actx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
    actx.closePath()
    actx.clip()
    if (picture) {
      const scale = Math.max(AVATAR_SIZE / picture.naturalWidth, AVATAR_SIZE / picture.naturalHeight)
      const dw = picture.naturalWidth * scale
      const dh = picture.naturalHeight * scale
      actx.drawImage(picture, (AVATAR_SIZE - dw) / 2, (AVATAR_SIZE - dh) / 2, dw, dh)
    } else {
      const fill = actx.createLinearGradient(0, 0, AVATAR_SIZE, AVATAR_SIZE)
      fill.addColorStop(0, '#4a86ad')
      fill.addColorStop(1, '#16324f')
      actx.fillStyle = fill
      actx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
      actx.fillStyle = '#ffffff'
      actx.font = `600 64px ${serif}`
      actx.textAlign = 'center'
      actx.textBaseline = 'middle'
      actx.fillText((r.userName || r.userUsername || '?').trim().charAt(0).toUpperCase(), AVATAR_SIZE / 2, AVATAR_SIZE / 2 + 4)
    }
    // A thin white edge keeps the picture crisp against the background.
    actx.lineWidth = 6
    actx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
    actx.beginPath()
    actx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
    actx.stroke()
    avatar = avatarCanvas
  }

  /* The app's mark and name, with the reciter's name under it, for the bottom-left corner */
  const badgeWidth = 520
  const mark = 40
  const textX = mark + 14
  const [badge, bctx] = makeCanvas(badgeWidth, 74)
  drawBrandMark(bctx, 2, 2, mark, serif)
  bctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  bctx.font = `700 18px ${serif}`
  bctx.textAlign = 'left'
  bctx.textBaseline = 'top'
  bctx.fillText(`${APP_NAME} App`, textX, 2)
  bctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  bctx.font = `500 15px ${sans}`
  const fullName = r.userName || r.userUsername
  let name = fullName
  while (name.length > 1 && bctx.measureText(name).width > badgeWidth - textX - 4) name = name.slice(0, -1)
  if (name !== fullName) name = `${name.trimEnd()}…`
  bctx.fillText(name, textX, 26)

  const { level, frames } = analyse(buffer)
  return {
    background: backgroundImage,
    backgroundVideo,
    backgroundVideoDuration: backgroundVideo?.duration || 0,
    avatar,
    badge,
    captions,
    translationFont,
    translationRtl,
    level,
    frames,
    seconds: buffer.duration,
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, t: number) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  const backgroundMedia = scene.backgroundVideo || scene.background
  if (backgroundMedia) {
    const { w, h } = mediaSize(backgroundMedia)
    const scale = Math.max(W / w, H / h)
    const dw = w * scale
    const dh = h * scale
    ctx.drawImage(backgroundMedia, (W - dw) / 2, (H - dh) / 2, dw, dh)
    // A dark wash so the ayah, picture and name stay legible on any photo or clip.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(0, 0, W, H)
  }

  const f = Math.max(0, Math.min(scene.frames - 1, Math.floor(t * FPS)))
  const level = scene.level[f] ?? 0

  // The ayah being recited, if the reciter marked any — the last one whose
  // timestamp has passed, so it holds until the next mark takes over. Drawn
  // as one centred group with its translation underneath.
  let caption: CaptionBlock | null = null
  for (const c of scene.captions) {
    if (c.atSeconds > t) break
    caption = c
  }
  if (caption) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)'
    ctx.shadowBlur = 18

    let y = (CAPTION_TOP + CAPTION_BOTTOM - caption.groupHeight) / 2

    ctx.direction = 'rtl'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#ffffff'
    ctx.font = `${caption.arabicWeight} ${caption.arabic.fontSize}px ${caption.arabicFont}`.trim()
    y += caption.arabic.lineHeight * 0.78
    for (const line of caption.arabic.lines) {
      ctx.fillText(line, W / 2, y)
      y += caption.arabic.lineHeight
    }

    if (caption.translation) {
      y += 56 - caption.arabic.lineHeight * 0.78 + caption.translation.lineHeight * 0.78
      ctx.direction = scene.translationRtl ? 'rtl' : 'ltr'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.font = `500 ${caption.translation.fontSize}px ${scene.translationFont}`
      for (const line of caption.translation.lines) {
        ctx.fillText(line, W / 2, y)
        y += caption.translation.lineHeight
      }
    }
    ctx.restore()
  }

  if (scene.avatar) {
    // A soft ring breathing out from the picture with the voice.
    const r = AVATAR_SIZE / 2
    ctx.save()
    ctx.strokeStyle = '#ffffff'
    ctx.globalAlpha = 0.12 + level * 0.3
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(W / 2, AVATAR_Y, r + 12 + level * 16, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    ctx.drawImage(scene.avatar, W / 2 - r, AVATAR_Y - r)
  }

  ctx.drawImage(scene.badge, 40, H - 100)

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
  onProgress(0.03)
  const buffer = await renderRecitationAudio(r, signal)
  onProgress(0.1)

  const mb = await import('mediabunny')
  if (!(await mb.canEncodeVideo('avc', { width: W, height: H }))) {
    throw new Error(tr('This browser cannot make videos yet. Update it, or share the audio instead.'))
  }
  // AAC is what every app expects inside an MP4. Where the browser has no AAC
  // encoder, MP3 inside the MP4 plays just as widely.
  let audioCodec: 'aac' | 'mp3' = 'aac'
  if (!(await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE }))) {
    await ensureMp3Encoder()
    audioCodec = 'mp3'
  }
  throwIfCancelled(signal)

  const scene = await prepareScene(r, buffer, options)
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

  try {
    for (let i = 0; i < totalFrames; i += 1) {
      throwIfCancelled(signal)
      const t = i / FPS
      // The export runs frame-by-frame, not in real time, so the clip is
      // advanced by seeking rather than played — looped under a recitation
      // longer than the clip itself.
      if (scene.backgroundVideo && scene.backgroundVideoDuration > 0) {
        await seekVideoTo(scene.backgroundVideo, t % scene.backgroundVideoDuration)
      }
      drawFrame(ctx, scene, t)
      await video.add(t, 1 / FPS)

      // Audio is fed alongside the frames so the file interleaves as it is written.
      while (audioCursor < buffer.length && audioCursor / buffer.sampleRate <= t + 1) {
        const end = Math.min(buffer.length, audioCursor + audioChunk)
        await audio.add(sliceBuffer(buffer, audioCursor, end))
        audioCursor = end
      }
      if (i % 6 === 0) onProgress(0.1 + 0.88 * (i / totalFrames))
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
