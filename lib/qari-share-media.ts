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
  if (!blob || blob.size === 0) throw new Error('Could not download that recitation.')
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

function sliceBuffer(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const out = new AudioBuffer({
    length: end - start,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  })
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    out.copyToChannel(buffer.getChannelData(channel).subarray(start, end), channel)
  }
  return out
}

let mp3EncoderReady: Promise<void> | null = null

/** Browsers almost never encode MP3 natively; a small bundled encoder covers them. */
function ensureMp3Encoder(): Promise<void> {
  if (!mp3EncoderReady) {
    mp3EncoderReady = (async () => {
      const { canEncodeAudio } = await import('mediabunny')
      if (await canEncodeAudio('mp3')) return
      const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder')
      registerMp3Encoder()
    })()
  }
  return mp3EncoderReady
}

export async function makeRecitationAudio(
  r: Recitation,
  onProgress: Progress,
  signal?: AbortSignal
): Promise<ShareMedia> {
  onProgress(0.04)
  const buffer = await renderRecitationAudio(r, signal)
  onProgress(0.25)

  const mb = await import('mediabunny')
  await ensureMp3Encoder()
  throwIfCancelled(signal)

  const output = new mb.Output({ format: new mb.Mp3OutputFormat(), target: new mb.BufferTarget() })
  // Medium is well past transparent for a voice, and keeps files quick to send.
  const source = new mb.AudioBufferSource({ codec: 'mp3', quality: mb.QUALITY_MEDIUM })
  output.addAudioTrack(source)
  await output.start()

  const chunk = buffer.sampleRate * 2
  for (let start = 0; start < buffer.length; start += chunk) {
    if (signal?.aborted) {
      await output.cancel()
      throw new ShareCancelled()
    }
    const end = Math.min(buffer.length, start + chunk)
    await source.add(sliceBuffer(buffer, start, end))
    onProgress(0.25 + 0.73 * (end / buffer.length))
  }

  await output.finalize()
  const data = output.target.buffer
  if (!data) throw new Error('Could not prepare the audio.')
  onProgress(1)
  return {
    kind: 'audio',
    blob: new Blob([data], { type: 'audio/mpeg' }),
    fileName: `${fileStem(r)}.mp3`,
    mimeType: 'audio/mpeg',
  }
}

/* ------------------------------------------------------------------ video */

/**
 * The look: plain black, the reciter's picture small in the middle, a waveform
 * that follows the voice's own frequencies, and the app's mark with the
 * reciter's name under it in the corner. Nothing else.
 */

/** Frequency bands; the bars mirror them, low voices in the middle and higher ones outwards. */
const BANDS = 18
const BAR_WIDTH = 6
const BAR_GAP = 6

const AVATAR_Y = 600
const AVATAR_SIZE = 148
const WAVE_Y = 780

interface Scene {
  avatar: HTMLCanvasElement
  badge: HTMLCanvasElement
  /** Band levels per frame, 0–1: frame f, band b is at f * BANDS + b. */
  bands: Float32Array
  /** Overall loudness per frame, 0–1. */
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

function makeCanvas(width = W, height = H): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not draw the video on this device.')
  return [canvas, ctx]
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

/** In-place fast Fourier transform. Both arrays must have a power-of-two length. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]
      re[i] = re[j]
      re[j] = tr
      const ti = im[i]
      im[i] = im[j]
      im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wr = Math.cos(angle)
    const wi = Math.sin(angle)
    const half = len >> 1
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let j = 0; j < half; j += 1) {
        const a = i + j
        const b = a + half
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const next = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = next
      }
    }
  }
}

/**
 * Listen to the whole recitation once, frame by frame: how loud it is and how
 * that loudness spreads across the voice's range. The bars are drawn from this.
 */
function analyse(buffer: AudioBuffer): { bands: Float32Array; level: Float32Array; frames: number } {
  const data = buffer.getChannelData(0)
  const frames = Math.max(1, Math.ceil(buffer.duration * FPS))
  const size = 1024
  const windowShape = new Float32Array(size)
  for (let i = 0; i < size; i += 1) windowShape[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1))

  // Log-spaced bands from 90 Hz to 7 kHz: where a reciting voice lives.
  const binHz = buffer.sampleRate / size
  const edges: number[] = []
  for (let b = 0; b <= BANDS; b += 1) {
    const bin = Math.round((90 * Math.pow(7000 / 90, b / BANDS)) / binHz)
    edges.push(b > 0 ? Math.max(edges[b - 1] + 1, bin) : Math.max(1, bin))
  }

  const re = new Float32Array(size)
  const im = new Float32Array(size)
  const raw = new Float32Array(frames * BANDS)
  const loud = new Float32Array(frames)

  for (let f = 0; f < frames; f += 1) {
    const start = Math.floor((f / FPS) * buffer.sampleRate) - size / 2
    let energy = 0
    for (let i = 0; i < size; i += 1) {
      const index = start + i
      const sample = index >= 0 && index < data.length ? data[index] : 0
      re[i] = sample * windowShape[i]
      im[i] = 0
      energy += sample * sample
    }
    loud[f] = Math.sqrt(energy / size)
    fft(re, im)
    for (let b = 0; b < BANDS; b += 1) {
      let sum = 0
      for (let k = edges[b]; k < edges[b + 1]; k += 1) sum += Math.hypot(re[k], im[k])
      raw[f * BANDS + b] = sum / (edges[b + 1] - edges[b])
    }
  }

  // Each band is measured against its own loud moments, so the treble moves as
  // freely as the bass instead of sitting flat beside it.
  const ceiling = new Float32Array(BANDS)
  const column = new Float32Array(frames)
  for (let b = 0; b < BANDS; b += 1) {
    for (let f = 0; f < frames; f += 1) column[f] = raw[f * BANDS + b]
    const sorted = Float32Array.from(column).sort()
    ceiling[b] = sorted[Math.floor(sorted.length * 0.96)] || 1e-6
  }
  const sortedLoud = Float32Array.from(loud).sort()
  const loudCeiling = sortedLoud[Math.floor(sortedLoud.length * 0.97)] || 1e-6

  const level = new Float32Array(frames)
  const bands = new Float32Array(frames * BANDS)
  const held = new Float32Array(BANDS)
  let heldLevel = 0
  for (let f = 0; f < frames; f += 1) {
    const targetLevel = Math.min(1, Math.pow(loud[f] / loudCeiling, 0.7))
    heldLevel += (targetLevel - heldLevel) * (targetLevel > heldLevel ? 0.5 : 0.16)
    level[f] = heldLevel
    for (let b = 0; b < BANDS; b += 1) {
      // Quiet stretches settle the bars down rather than showing room noise.
      const target = Math.min(1, Math.pow(raw[f * BANDS + b] / ceiling[b], 0.75)) * (0.25 + 0.75 * targetLevel)
      held[b] += (target - held[b]) * (target > held[b] ? 0.6 : 0.2)
      bands[f * BANDS + b] = held[b]
    }
  }

  return { bands, level, frames }
}

async function prepareScene(r: Recitation, buffer: AudioBuffer): Promise<Scene> {
  const serif = cssFont('--font-home-serif', "'Fraunces', Georgia, serif")
  const sans = cssFont('--font-sans', 'system-ui, sans-serif')

  const [picture] = await Promise.all([
    loadImage(`/api/qari/avatar/${encodeURIComponent(r.userUsername.toLowerCase())}`),
    document.fonts
      ? Promise.all([
          document.fonts.load(`700 30px ${serif}`, APP_ICON_LETTER),
          document.fonts.load(`600 30px ${sans}`, r.userName),
        ]).catch(() => null)
      : null,
  ])

  /* The picture, small and round; the initial on deep blue when there is none */
  const [avatar, actx] = makeCanvas(AVATAR_SIZE, AVATAR_SIZE)
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
  // A thin white edge keeps the picture crisp against the black.
  actx.lineWidth = 6
  actx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
  actx.beginPath()
  actx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
  actx.stroke()

  /* The app's mark with the reciter's name under it, for the bottom-left corner */
  const badgeWidth = 520
  const mark = 48
  const [badge, bctx] = makeCanvas(badgeWidth, 92)
  drawBrandMark(bctx, 2, 2, mark, serif)
  bctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  bctx.font = `600 22px ${sans}`
  bctx.textAlign = 'left'
  bctx.textBaseline = 'top'
  const fullName = r.userName || r.userUsername
  let name = fullName
  while (name.length > 1 && bctx.measureText(name).width > badgeWidth - 8) name = name.slice(0, -1)
  if (name !== fullName) name = `${name.trimEnd()}…`
  bctx.fillText(name, 2, mark + 14)

  const { bands, level, frames } = analyse(buffer)
  return { avatar, badge, bands, level, frames, seconds: buffer.duration }
}

function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, t: number) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  const f = Math.max(0, Math.min(scene.frames - 1, Math.floor(t * FPS)))
  const level = scene.level[f] ?? 0

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

  // The waveform: mirrored bars with a faint glow, tallest in the middle.
  const count = BANDS * 2 - 1
  const span = count * BAR_WIDTH + (count - 1) * BAR_GAP
  const left = (W - span) / 2
  ctx.save()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.shadowColor = 'rgba(255, 255, 255, 0.4)'
  ctx.shadowBlur = 16
  ctx.beginPath()
  for (let i = 0; i < count; i += 1) {
    const band = Math.abs(i - (BANDS - 1))
    const value = scene.bands[f * BANDS + band] ?? 0
    const taper = 1 - (band / BANDS) * 0.45
    const height = BAR_WIDTH + value * 116 * taper
    ctx.roundRect(left + i * (BAR_WIDTH + BAR_GAP), WAVE_Y - height / 2, BAR_WIDTH, height, BAR_WIDTH / 2)
  }
  ctx.fill()
  ctx.restore()

  ctx.drawImage(scene.badge, 40, H - 240)

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
  signal?: AbortSignal
): Promise<ShareMedia> {
  onProgress(0.03)
  const buffer = await renderRecitationAudio(r, signal)
  onProgress(0.1)

  const mb = await import('mediabunny')
  if (!(await mb.canEncodeVideo('avc', { width: W, height: H }))) {
    throw new Error('This browser cannot make videos yet. Update it, or share the audio instead.')
  }
  // AAC is what every app expects inside an MP4. Where the browser has no AAC
  // encoder, MP3 inside the MP4 plays just as widely.
  let audioCodec: 'aac' | 'mp3' = 'aac'
  if (!(await mb.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: SAMPLE_RATE }))) {
    await ensureMp3Encoder()
    audioCodec = 'mp3'
  }
  throwIfCancelled(signal)

  const scene = await prepareScene(r, buffer)
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
  if (!data) throw new Error('Could not make the video.')
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
