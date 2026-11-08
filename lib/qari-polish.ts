/**
 * Turns what the microphone heard into a finished recitation.
 *
 * The take is recorded untouched, then polished once, on the phone, before it
 * is heard back or uploaded:
 *
 *  1. brought to a steady level, so a quiet phone and a loud one start alike;
 *  2. trimmed of the silence around it, and given short fades;
 *  3. cleaned of steady room noise with RNNoise, but only when the room was
 *     noisy and the phone is fast enough — a clean take is left alone;
 *  4. shaped by the voice chain (see audio-space);
 *  5. set to -16 LUFS, the same loudness for every recitation in the feed;
 *  6. saved as AAC (or MP3 where the browser cannot), which every phone and
 *     messaging app can play.
 *
 * The maths is in qari-polish-dsp, which is measured against real recordings.
 */

import { buildVoiceShaping } from '@/lib/audio-space'
import { encodeRecording } from '@/lib/qari-mp3'
import {
  analyze,
  applyFades,
  applyGain,
  denoise,
  gainToTarget,
  integratedLoudness,
  judge,
  limitPeaks,
  PEAK_CEILING_DB,
  TARGET_LUFS,
  trimBounds,
  type Quality,
} from '@/lib/qari-polish-dsp'
import { tr } from '@/lib/i18n-core'

const RATE = 48000
/** The voice is brought to about here before anything else touches it. */
const WORKING_VOICE_DB = -20
/**
 * A take whose voice stands this far above its room is left alone: cleaning it
 * would cost time and a little of the voice for nothing anyone would hear.
 */
const CLEAN_ENOUGH_SNR_DB = 32
export type PolishStage = 'reading' | 'levelling' | 'cleaning' | 'shaping' | 'saving'

export interface PolishResult {
  blob: Blob
  mimeType: 'audio/mp4' | 'audio/mpeg'
  durationSec: number
  /** How the take came out, so the reciter can be told when it could be better. */
  quality: Quality
  /** Whether room noise was removed. */
  cleaned: boolean
}

/** A phone that is short on memory or cores gets the light version. */
function isWeakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (nav.hardwareConcurrency ?? 4) <= 2 || (nav.deviceMemory ?? 4) <= 2
}

function toMono(buffer: AudioBuffer): Float32Array {
  const first = buffer.getChannelData(0)
  if (buffer.numberOfChannels === 1) return Float32Array.from(first)
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < out.length; i += 1) out[i] += data[i] / buffer.numberOfChannels
  }
  return out
}

function toBuffer(ctx: BaseAudioContext, samples: Float32Array): AudioBuffer {
  const buffer = ctx.createBuffer(1, samples.length, RATE)
  buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
  return buffer
}

/** Hand the thread back to the page so the screen keeps moving. */
const breathe = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0))

async function loadDenoiser() {
  const { Rnnoise } = await import('@shiguredo/rnnoise-wasm')
  const rnnoise = await Rnnoise.load()
  const state = rnnoise.createDenoiseState()
  return {
    frameSize: rnnoise.frameSize,
    processFrame: (frame: Float32Array) => state.processFrame(frame),
    destroy: () => state.destroy(),
  }
}

export async function polishRecording(
  input: Blob,
  onProgress: (fraction: number, stage: PolishStage) => void = () => {}
): Promise<PolishResult> {
  onProgress(0.02, 'reading')
  // An offline context decodes without ever asking for the speaker.
  const decoder = new OfflineAudioContext(1, 1, RATE)
  const decoded = await decoder.decodeAudioData(await input.arrayBuffer())
  let samples = toMono(decoded)
  await breathe()

  /* 1. Level, and a look at how the take came out. */
  onProgress(0.1, 'levelling')
  const before = analyze(samples, RATE)
  const quality = judge(before)
  if (before.peakDb > -90) {
    let lift = WORKING_VOICE_DB - before.voiceDb
    lift = Math.max(-6, Math.min(24, lift))
    // Never lift into clipping.
    lift = Math.min(lift, -1 - before.peakDb)
    applyGain(samples, lift)
  }
  const levelled = analyze(samples, RATE)

  /* 2. Trim to the recitation. */
  const { start, end } = trimBounds(samples, RATE, levelled)
  if (end - start >= RATE && (start > 0 || end < samples.length)) samples = samples.slice(start, end)
  await breathe()

  /* 3. Room noise, only where it is heard. */
  let cleaned = false
  const noisy = quality === 'noisy' || levelled.snrDb < CLEAN_ENOUGH_SNR_DB
  if (noisy) {
    onProgress(0.2, 'cleaning')
    try {
      const denoiser = await loadDenoiser()
      // How much is taken out follows how bad the room was: a little for a
      // faint hiss, most of it for a loud one.
      const severity = Math.min(1, Math.max(0, (CLEAN_ENOUGH_SNR_DB + 6 - levelled.snrDb) / 14))
      const amount = 0.55 + 0.35 * severity
      const result = await denoise(samples, denoiser, {
        amount,
        budgetMs: isWeakDevice() ? 10000 : 60000,
        onProgress: async (done) => {
          onProgress(0.2 + 0.25 * done, 'cleaning')
          await breathe()
        },
      })
      denoiser.destroy()
      if (result) {
        samples = result
        cleaned = true
      }
    } catch {
      // No wasm, or it failed: the take simply keeps its room.
    }
  }

  /* 4. The voice chain, rendered faster than real time. */
  onProgress(0.5, 'shaping')
  const tail = Math.round(RATE * 0.4)
  const offline = new OfflineAudioContext(1, samples.length + tail, RATE)
  const source = offline.createBufferSource()
  source.buffer = toBuffer(offline, samples)
  const voice = await buildVoiceShaping(offline, source)
  voice.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  let shaped = Float32Array.from(rendered.getChannelData(0))

  /* 5. Loudness and fades. */
  onProgress(0.75, 'shaping')
  const loudness = integratedLoudness(shaped)
  applyGain(shaped, gainToTarget(shaped, loudness))
  limitPeaks(shaped)
  applyFades(shaped, RATE)
  await breathe()

  /* 6. Save. */
  onProgress(0.8, 'saving')
  const context = new OfflineAudioContext(1, 1, RATE)
  const buffer = toBuffer(context, shaped)
  const durationSec = Math.max(1, Math.round(buffer.duration))
  // A ten-minute take at medium quality still fits the upload limit; longer never happens.
  let saved = await encodeRecording(buffer, 'medium', (f) => onProgress(0.8 + 0.2 * f, 'saving'))
  if (saved.blob.size > 11 * 1024 * 1024) saved = await encodeRecording(buffer, 'low')
  shaped = new Float32Array(0)

  onProgress(1, 'saving')
  return { blob: saved.blob, mimeType: saved.mimeType, durationSec, quality, cleaned }
}

/* ------------------------------------------------- a file made elsewhere */

/** The same limit as a recording made in the app. */
const MAX_UPLOAD_SECONDS = 600
/** A ten-minute stereo WAV is about 115 MB; far past that a phone runs out of memory decoding it. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024
/** The server takes 12 MB; this leaves room. */
const MAX_SAVED_BYTES = 11 * 1024 * 1024

/** Why a chosen file cannot be used, in words to show the reciter. */
export class UploadProblem extends Error {}

const tooLong = () => new UploadProblem(tr('That file is over 10 minutes. Recordings can be up to 10 minutes.'))

/** Its length from the file's own header, so a long file is turned away before it is decoded. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const finish = (seconds: number | null) => {
      window.clearTimeout(timer)
      audio.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    const timer = window.setTimeout(() => finish(null), 8000)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null)
    audio.onerror = () => finish(null)
    audio.src = url
  })
}

/**
 * A recording made outside the app, made ready to post. Only its loudness is
 * touched, to match the rest of the feed: the shaping, trimming and noise
 * removal in polishRecording are all for a phone's microphone, and would make a
 * recording from a real one worse. Stereo stays stereo.
 */
export async function prepareUpload(
  file: File,
  onProgress: (fraction: number, stage: PolishStage) => void = () => {}
): Promise<PolishResult> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadProblem(tr('That file is too large. Try an MP3 or M4A copy of it.'))

  onProgress(0.02, 'reading')
  const seconds = await readDuration(file)
  if (seconds !== null && seconds > MAX_UPLOAD_SECONDS + 1) throw tooLong()

  let decoded: AudioBuffer
  try {
    decoded = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new UploadProblem(tr('That file could not be read. Try an MP3, M4A or WAV file.'))
  }
  if (decoded.duration > MAX_UPLOAD_SECONDS + 1) throw tooLong()
  await breathe()

  /* The one gain for every channel, held under the ceiling rather than limited. */
  onProgress(0.4, 'levelling')
  const channels =
    decoded.numberOfChannels === 2
      ? [Float32Array.from(decoded.getChannelData(0)), Float32Array.from(decoded.getChannelData(1))]
      : [toMono(decoded)]
  let peak = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) peak = Math.max(peak, Math.abs(channel[i]))
  }
  const loudness = integratedLoudness(toMono(decoded))
  if (peak < 0.001 || !Number.isFinite(loudness)) throw new UploadProblem(tr('That file has no sound in it.'))
  const gain = Math.min(TARGET_LUFS - loudness, PEAK_CEILING_DB - 20 * Math.log10(peak))
  channels.forEach((channel) => applyGain(channel, gain))
  await breathe()

  /* Saved generously, since it started out well: as high as still fits the upload limit. */
  onProgress(0.6, 'saving')
  const context = new OfflineAudioContext(channels.length, 1, RATE)
  const buffer = context.createBuffer(channels.length, channels[0].length, RATE)
  channels.forEach((channel, c) => buffer.copyToChannel(channel as Float32Array<ArrayBuffer>, c))
  const wanted = channels.length === 2 ? 192_000 : 128_000
  const fits = (MAX_SAVED_BYTES * 8) / buffer.duration
  const bitrate = [wanted, 160_000, 128_000, 96_000].find((rate) => rate <= wanted && rate <= fits) ?? 64_000
  let saved = await encodeRecording(buffer, 'medium', (f) => onProgress(0.6 + 0.4 * f, 'saving'), bitrate)
  if (saved.blob.size > MAX_SAVED_BYTES) saved = await encodeRecording(buffer, 'low')

  onProgress(1, 'saving')
  return {
    blob: saved.blob,
    mimeType: saved.mimeType,
    durationSec: Math.max(1, Math.round(buffer.duration)),
    quality: 'good',
    cleaned: false,
  }
}
