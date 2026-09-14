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
import { formatDuration, prefetchRecitationAudio, type Recitation } from '@/lib/qari'

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

/** A short end card after the last word, so the app's name is the final thing seen. */
const OUTRO_SECONDS = 1.6

/** Photos that ship with the app; each recitation always gets the same one. */
const VIDEO_BACKGROUNDS = [
  'mosque-arches',
  'mosque-columns',
  'lantern',
  'night-sky',
  'islamic-pattern',
  'kiswah-gold',
]

const ACCENT = '#5cc4ab'

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

interface Scene {
  base: HTMLCanvasElement
  avatar: HTMLCanvasElement
  outro: HTMLCanvasElement
  /** Loudness per video frame, 0–1, smoothed so the rings breathe rather than flicker. */
  envelope: Float32Array
  peaks: Float32Array
  audioSeconds: number
  sans: string
  /** Vertical centre of the waveform, below however many lines the title took. */
  waveMid: number
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

function hashIndex(id: string, size: number): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % size
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  // Anything that did not fit ends the last line with an ellipsis.
  const shown = lines.join(' ').split(/\s+/).length
  if (shown < words.length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last.trimEnd()}…`
  }
  return lines
}

function shadowed(ctx: CanvasRenderingContext2D, draw: () => void) {
  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 2
  draw()
  ctx.restore()
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, serif: string) {
  const r = size * 0.24
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, size, size, r)
  ctx.fillStyle = '#000000'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.stroke()
  ctx.fillStyle = '#f5ecd8'
  ctx.font = `700 ${Math.round(size * 0.62)}px ${serif}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(APP_ICON_LETTER, x + size / 2, y + size / 2 + size * 0.04)
  ctx.restore()
}

/** Everything that never changes between frames, drawn once. */
async function prepareScene(r: Recitation, buffer: AudioBuffer): Promise<Scene> {
  const serif = cssFont('--font-home-serif', "'Fraunces', Georgia, serif")
  const sans = cssFont('--font-sans', 'system-ui, sans-serif')
  const arabic = cssFont('--font-amiri', "'Amiri', serif")
  const titleFont = `${serif}, ${arabic}`

  const backgroundId = VIDEO_BACKGROUNDS[hashIndex(r.id, VIDEO_BACKGROUNDS.length)]
  const [photo, picture] = await Promise.all([
    loadImage(`/share-bg/${backgroundId}.jpg`),
    loadImage(`/api/qari/avatar/${encodeURIComponent(r.userUsername.toLowerCase())}`),
    document.fonts
      ? Promise.all([
          document.fonts.load(`600 48px ${serif}`, r.title),
          document.fonts.load(`600 28px ${sans}`, r.userName),
        ]).catch(() => null)
      : null,
  ])

  /* Base: photo, scrims, brand, words */
  const [base, ctx] = makeCanvas()
  ctx.fillStyle = '#0f1513'
  ctx.fillRect(0, 0, W, H)
  if (photo) {
    const scale = Math.max(W / photo.naturalWidth, H / photo.naturalHeight)
    const dw = photo.naturalWidth * scale
    const dh = photo.naturalHeight * scale
    ctx.drawImage(photo, (W - dw) / 2, (H - dh) / 2, dw, dh)
  }
  ctx.fillStyle = 'rgba(8, 12, 11, 0.58)'
  ctx.fillRect(0, 0, W, H)
  const scrim = ctx.createLinearGradient(0, 0, 0, H)
  scrim.addColorStop(0, 'rgba(6, 10, 9, 0.55)')
  scrim.addColorStop(0.3, 'rgba(6, 10, 9, 0.1)')
  scrim.addColorStop(0.62, 'rgba(6, 10, 9, 0.32)')
  scrim.addColorStop(1, 'rgba(6, 10, 9, 0.85)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, W, H)

  // Brand, centred as one unit: mark + name.
  ctx.font = `600 32px ${serif}`
  const markSize = 52
  const nameWidth = ctx.measureText(APP_NAME).width
  const brandWidth = markSize + 14 + nameWidth
  const brandX = (W - brandWidth) / 2
  shadowed(ctx, () => drawBrandMark(ctx, brandX, 92, markSize, serif))
  shadowed(ctx, () => {
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 32px ${serif}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(APP_NAME, brandX + markSize + 14, 92 + markSize / 2 + 2)
  })
  shadowed(ctx, () => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.font = `500 20px ${sans}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('Quran recitations', W / 2, 182)
  })

  // Title, up to two lines.
  ctx.font = `600 48px ${titleFont}`
  const titleLines = wrap(ctx, r.title, 600, 2)
  let y = 652
  shadowed(ctx, () => {
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    for (const line of titleLines) {
      ctx.fillText(line, W / 2, y)
      y += 60
    }
  })
  y += 2
  shadowed(ctx, () => {
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 30px ${sans}`
    ctx.textAlign = 'center'
    ctx.fillText(r.userName, W / 2, y)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.font = `500 23px ${sans}`
    ctx.fillText(`@${r.userUsername}`, W / 2, y + 36)
  })
  // A two-line title pushes the waveform down rather than under the handle.
  const waveMid = Math.max(846, y + 36 + 70)

  // Call to action, kept above the strip TikTok covers with its own caption.
  shadowed(ctx, () => {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.font = `500 21px ${sans}`
    ctx.fillText('Listen and recite on', W / 2, 988)
    ctx.fillStyle = ACCENT
    ctx.font = `600 32px ${serif}`
    ctx.fillText(APP_NAME, W / 2, 1028)
  })

  /* Avatar: the picture, or the initial on the accent */
  const size = 208
  const [avatar, actx] = makeCanvas(size, size)
  actx.beginPath()
  actx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  actx.closePath()
  actx.clip()
  if (picture) {
    const scale = Math.max(size / picture.naturalWidth, size / picture.naturalHeight)
    const dw = picture.naturalWidth * scale
    const dh = picture.naturalHeight * scale
    actx.drawImage(picture, (size - dw) / 2, (size - dh) / 2, dw, dh)
  } else {
    const fill = actx.createLinearGradient(0, 0, size, size)
    fill.addColorStop(0, '#2f7f6e')
    fill.addColorStop(1, '#11302b')
    actx.fillStyle = fill
    actx.fillRect(0, 0, size, size)
    actx.fillStyle = '#f1ede3'
    actx.font = `600 104px ${serif}`
    actx.textAlign = 'center'
    actx.textBaseline = 'middle'
    actx.fillText((r.userName || r.userUsername || '?').trim().charAt(0).toUpperCase(), size / 2, size / 2 + 6)
  }

  /* End card */
  const [outro, octx] = makeCanvas()
  octx.fillStyle = 'rgba(6, 10, 9, 0.94)'
  octx.fillRect(0, 0, W, H)
  drawBrandMark(octx, (W - 120) / 2, 470, 120, serif)
  octx.fillStyle = '#ffffff'
  octx.font = `600 56px ${serif}`
  octx.textAlign = 'center'
  octx.textBaseline = 'alphabetic'
  octx.fillText(APP_NAME, W / 2, 680)
  octx.fillStyle = 'rgba(255, 255, 255, 0.72)'
  octx.font = `500 24px ${sans}`
  octx.fillText('Listen and recite the Quran together', W / 2, 728)

  /* Loudness, per frame and as a strip of peaks */
  const data = buffer.getChannelData(0)
  const frames = Math.ceil(buffer.duration * FPS)
  const envelope = new Float32Array(frames)
  const perFrame = Math.floor(buffer.sampleRate / FPS)
  let smooth = 0
  for (let f = 0; f < frames; f += 1) {
    const start = f * perFrame
    const end = Math.min(data.length, start + perFrame)
    let sum = 0
    for (let i = start; i < end; i += 4) sum += data[i] * data[i]
    const rms = Math.sqrt(sum / Math.max(1, (end - start) / 4))
    const level = Math.min(1, Math.pow(rms * 5, 0.8))
    smooth += (level - smooth) * (level > smooth ? 0.55 : 0.14)
    envelope[f] = smooth
  }

  const bars = 44
  const peaks = new Float32Array(bars)
  const bucket = Math.floor(data.length / bars) || 1
  let loudest = 0
  for (let b = 0; b < bars; b += 1) {
    let sum = 0
    const start = b * bucket
    const end = Math.min(data.length, start + bucket)
    for (let i = start; i < end; i += 16) sum += data[i] * data[i]
    peaks[b] = Math.sqrt(sum / Math.max(1, (end - start) / 16))
    loudest = Math.max(loudest, peaks[b])
  }
  for (let b = 0; b < bars; b += 1) peaks[b] = 0.14 + 0.86 * (loudest > 0 ? peaks[b] / loudest : 0)

  return { base, avatar, outro, envelope, peaks, audioSeconds: buffer.duration, sans, waveMid }
}

function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, t: number) {
  ctx.drawImage(scene.base, 0, 0)

  const frame = Math.min(scene.envelope.length - 1, Math.floor(t * FPS))
  const level = t < scene.audioSeconds ? scene.envelope[Math.max(0, frame)] : 0
  const progress = Math.min(1, t / scene.audioSeconds)

  // Rings that swell with the voice, never reaching the title below.
  const cx = W / 2
  const cy = 400
  const radius = scene.avatar.width / 2
  ctx.save()
  ctx.strokeStyle = ACCENT
  ctx.globalAlpha = 0.22 + level * 0.3
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 14 + level * 30, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.1 + level * 0.18
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, radius + 34 + level * 44, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  ctx.save()
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 28
  ctx.drawImage(scene.avatar, cx - radius, cy - radius)
  ctx.restore()

  // Waveform: played bars in the accent, the current one lifted by the voice.
  const bars = scene.peaks.length
  const left = 110
  const span = W - left * 2
  const step = span / bars
  const barWidth = Math.max(3, step * 0.52)
  const mid = scene.waveMid
  for (let b = 0; b < bars; b += 1) {
    const at = (b + 0.5) / bars
    const played = at <= progress
    const isCurrent = Math.abs(at - progress) < 0.5 / bars
    const height = Math.max(6, scene.peaks[b] * 70 * (isCurrent ? 1 + level * 0.5 : 1))
    ctx.fillStyle = played ? ACCENT : 'rgba(255, 255, 255, 0.32)'
    ctx.beginPath()
    ctx.roundRect(left + b * step + (step - barWidth) / 2, mid - height / 2, barWidth, height, barWidth / 2)
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
  ctx.font = `500 21px ${scene.sans}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const elapsed = Math.min(scene.audioSeconds, t)
  ctx.fillText(`${formatDuration(elapsed)} / ${formatDuration(scene.audioSeconds)}`, W / 2, mid + 66)

  // End card fades in once the recitation is over.
  if (t > scene.audioSeconds) {
    ctx.save()
    ctx.globalAlpha = Math.min(1, (t - scene.audioSeconds) / 0.45)
    ctx.drawImage(scene.outro, 0, 0)
    ctx.restore()
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

  const totalFrames = Math.ceil((buffer.duration + OUTRO_SECONDS) * FPS)
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
