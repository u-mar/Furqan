/**
 * The maths behind polishing a recitation after it is recorded: how noisy the
 * room was, where the speech starts and ends, how loud it is by the broadcast
 * standard (ITU BS.1770 / EBU R128), and the gain, fades and noise removal that
 * follow from that.
 *
 * Plain functions on plain arrays, with no browser APIs, so the same code
 * can be run and measured outside the app.
 */

/** Streaming loudness target: a little under Spotify's -14, comfortable on a phone speaker. */
export const TARGET_LUFS = -16
/** Highest a sample may reach after gain. Leaves room for the encoder. */
export const PEAK_CEILING_DB = -1

const toDb = (linear: number) => (linear > 1e-9 ? 20 * Math.log10(linear) : -180)
const fromDb = (db: number) => Math.pow(10, db / 20)

/** RMS level of each 20 ms frame, in dBFS. */
export function frameLevelsDb(samples: Float32Array, rate: number, frameMs = 20): Float32Array {
  const size = Math.max(1, Math.round((rate * frameMs) / 1000))
  const frames = Math.floor(samples.length / size)
  const out = new Float32Array(frames)
  for (let f = 0; f < frames; f += 1) {
    let sum = 0
    const from = f * size
    for (let i = 0; i < size; i += 1) sum += samples[from + i] * samples[from + i]
    out[f] = toDb(Math.sqrt(sum / size))
  }
  return out
}

function percentile(values: Float32Array, p: number): number {
  if (!values.length) return -180
  const sorted = Float32Array.from(values).sort()
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))))]
}

export interface Analysis {
  /** Highest sample, dBFS. */
  peakDb: number
  /** The room with nobody speaking, dBFS: the quietest tenth of the recording. */
  noiseFloorDb: number
  /** How loud the voice is, dBFS: the loud end of the recording. */
  voiceDb: number
  /** Share of samples at or past full scale, 0–1. */
  clipped: number
  /** Voice against room, in dB. Under about 25 the room is easy to hear. */
  snrDb: number
}

export function analyze(samples: Float32Array, rate: number): Analysis {
  let peak = 0
  let clipped = 0
  for (let i = 0; i < samples.length; i += 1) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
    if (a >= 0.999) clipped += 1
  }
  const levels = frameLevelsDb(samples, rate)
  const noiseFloorDb = percentile(levels, 10)
  const voiceDb = percentile(levels, 90)
  return {
    peakDb: toDb(peak),
    noiseFloorDb,
    voiceDb,
    clipped: samples.length ? clipped / samples.length : 0,
    snrDb: voiceDb - noiseFloorDb,
  }
}

/**
 * Where the recitation really starts and stops: the first and last frames that
 * stand well above the room, with a breath of silence kept on both sides so
 * nothing is cut short. The tap that started the take and the reach to stop it
 * are what this removes.
 */
export function trimBounds(
  samples: Float32Array,
  rate: number,
  analysis: Analysis,
  padStartSec = 0.3,
  padEndSec = 0.5
): { start: number; end: number } {
  const levels = frameLevelsDb(samples, rate)
  // Comfortably above the room, but never so high that a quiet reciter is cut.
  const gate = Math.max(analysis.noiseFloorDb + 10, -60)
  const frame = Math.round(rate * 0.02)
  let first = 0
  while (first < levels.length && levels[first] < gate) first += 1
  let last = levels.length - 1
  while (last > first && levels[last] < gate) last -= 1
  if (first >= levels.length) return { start: 0, end: samples.length }
  const start = Math.max(0, first * frame - Math.round(padStartSec * rate))
  const end = Math.min(samples.length, (last + 1) * frame + Math.round(padEndSec * rate))
  return { start, end }
}

/* ------------------------------------------------------------- loudness */

/** BS.1770 K-weighting at 48 kHz: a high shelf for the head, then a 38 Hz high-pass. */
const K_SHELF = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] }
const K_HIGHPASS = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] }

/**
 * Integrated loudness in LUFS, as broadcast meters read it: K-weighted, in
 * 400 ms blocks, ignoring silence and anything far below the average.
 * Coefficients are for 48 kHz, so the audio must be at that rate.
 *
 * Runs in one pass over the samples and keeps only a number per 100 ms, so a
 * ten-minute take does not need a second copy of itself in memory.
 */
export function integratedLoudness(samples: Float32Array): number {
  const hop = 4800
  const hops = Math.floor(samples.length / hop)
  const sums = new Float64Array(hops)
  // Filter state for the two K-weighting stages.
  let s1x1 = 0, s1x2 = 0, s1y1 = 0, s1y2 = 0
  let s2x1 = 0, s2x2 = 0, s2y1 = 0, s2y2 = 0
  const [b0, b1, b2] = K_SHELF.b
  const [a1, a2] = K_SHELF.a
  const [c0, c1, c2] = K_HIGHPASS.b
  const [d1, d2] = K_HIGHPASS.a
  for (let h = 0; h < hops; h += 1) {
    let sum = 0
    const from = h * hop
    for (let i = 0; i < hop; i += 1) {
      const x0 = samples[from + i]
      const y0 = b0 * x0 + b1 * s1x1 + b2 * s1x2 - a1 * s1y1 - a2 * s1y2
      s1x2 = s1x1; s1x1 = x0; s1y2 = s1y1; s1y1 = y0
      const z0 = c0 * y0 + c1 * s2x1 + c2 * s2x2 - d1 * s2y1 - d2 * s2y2
      s2x2 = s2x1; s2x1 = y0; s2y2 = s2y1; s2y1 = z0
      sum += z0 * z0
    }
    sums[h] = sum
  }
  // A block is four hops (400 ms), sliding by one (75% overlap).
  const energies: number[] = []
  for (let h = 0; h + 4 <= hops; h += 1) {
    energies.push((sums[h] + sums[h + 1] + sums[h + 2] + sums[h + 3]) / (hop * 4))
  }
  if (!energies.length) return -70
  const lufs = (e: number) => -0.691 + 10 * Math.log10(e)
  // Absolute gate: nothing under -70 LUFS counts.
  const loud = energies.filter((e) => lufs(e) > -70)
  if (!loud.length) return -70
  const mean = loud.reduce((x, y) => x + y, 0) / loud.length
  // Relative gate: 10 LU under what is left.
  const kept = loud.filter((e) => lufs(e) > lufs(mean) - 10)
  const gated = kept.reduce((x, y) => x + y, 0) / Math.max(1, kept.length)
  return lufs(gated)
}

/** How far past the ceiling the limiter is allowed to pull peaks back, in dB. */
const LIMITER_REACH_DB = 6

/**
 * Gain in dB that brings the recitation to the target. Peaks that end up over
 * the ceiling are then pulled back by limitPeaks, up to a few dB; past that
 * the target is not reached rather than squashing the voice.
 */
export function gainToTarget(samples: Float32Array, loudness: number, targetLufs = TARGET_LUFS): number {
  let peak = 0
  for (let i = 0; i < samples.length; i += 1) {
    const a = Math.abs(samples[i])
    if (a > peak) peak = a
  }
  const wanted = targetLufs - loudness
  const room = PEAK_CEILING_DB - toDb(peak) + LIMITER_REACH_DB
  return Math.min(wanted, room)
}

/**
 * Brings any peak above the ceiling back to it by dipping the level around
 * that moment, smoothly over about 10 ms, so it neither clips nor clicks.
 */
export function limitPeaks(samples: Float32Array, ceilingDb = PEAK_CEILING_DB, halfWidth = 240): number {
  const ceiling = fromDb(ceilingDb)
  let limited = 0
  for (let i = 0; i < samples.length; i += 1) {
    const level = Math.abs(samples[i])
    if (level <= ceiling) continue
    limited += 1
    const dip = 1 - ceiling / level
    const from = Math.max(0, i - halfWidth)
    const to = Math.min(samples.length - 1, i + halfWidth)
    for (let j = from; j <= to; j += 1) {
      const w = 0.5 + 0.5 * Math.cos((Math.PI * (j - i)) / halfWidth)
      samples[j] *= 1 - dip * w
    }
  }
  return limited
}

export function applyGain(samples: Float32Array, gainDb: number): void {
  const g = fromDb(gainDb)
  for (let i = 0; i < samples.length; i += 1) samples[i] *= g
}

/** A short fade in and a longer one out, so a take never starts or ends on a click. */
export function applyFades(samples: Float32Array, rate: number, inSec = 0.03, outSec = 0.25): void {
  const fadeIn = Math.min(Math.round(rate * inSec), samples.length >> 1)
  const fadeOut = Math.min(Math.round(rate * outSec), samples.length >> 1)
  for (let i = 0; i < fadeIn; i += 1) samples[i] *= i / fadeIn
  for (let i = 0; i < fadeOut; i += 1) samples[samples.length - 1 - i] *= i / fadeOut
}

/* -------------------------------------------------------------- denoise */

/** What RNNoise needs from its wasm module; kept minimal so it can be swapped or faked. */
export interface FrameDenoiser {
  frameSize: number
  /** In place, in 16-bit sample units. Returns how likely the frame is speech, 0–1. */
  processFrame(frame: Float32Array): number
}

/** RNNoise hands each frame back two frames (20 ms at 48 kHz) after it took it in. */
const DENOISER_DELAY_FRAMES = 2

export interface DenoiseOptions {
  /** How much of the cleaned voice replaces the original, 0–1. */
  amount?: number
  /** Called with 0–1 as it goes, and may hand the thread back to the page. */
  onProgress?: (done: number) => void | Promise<void>
  /** If the whole job would take longer than this, it is skipped. */
  budgetMs?: number
}

/**
 * Removes steady room noise with RNNoise, the small neural denoiser used in
 * video calls. Audio must be 48 kHz mono. Returns null when the job would run
 * past `budgetMs`, judged from the first second of audio, so a slow phone
 * skips this step instead of freezing.
 *
 * `amount` is how much of the cleaned voice replaces the original. Well under
 * 1 keeps a recitation natural: the denoiser was trained on speech, and a
 * sustained, sung vowel is exactly where it can start to sound thin.
 *
 * The cleaned audio is shifted back into place before it is mixed with the
 * original; left 20 ms late it would comb the voice.
 */
export async function denoise(
  samples: Float32Array,
  denoiser: FrameDenoiser,
  { amount = 0.85, onProgress, budgetMs = Infinity }: DenoiseOptions = {}
): Promise<Float32Array | null> {
  const size = denoiser.frameSize
  const length = samples.length
  const inputFrames = Math.ceil(length / size)
  const totalFrames = inputFrames + DENOISER_DELAY_FRAMES
  const out = new Float32Array(length)
  const frame = new Float32Array(size)
  const started = Date.now()
  let lastYield = started

  for (let f = 0; f < totalFrames; f += 1) {
    const from = f * size
    for (let i = 0; i < size; i += 1) frame[i] = from + i < length ? samples[from + i] * 32768 : 0
    denoiser.processFrame(frame)

    const at = from - DENOISER_DELAY_FRAMES * size
    for (let i = 0; i < size; i += 1) {
      const position = at + i
      if (position < 0 || position >= length) continue
      out[position] = (frame[i] / 32768) * amount + samples[position] * (1 - amount)
    }

    const now = Date.now()
    if (f === 100 && Number.isFinite(budgetMs)) {
      const projected = ((now - started) / 101) * totalFrames
      if (projected > budgetMs) return null
    }
    if (now - lastYield > 40) {
      lastYield = now
      await onProgress?.(f / totalFrames)
    }
  }
  return out
}

/* -------------------------------------------------------------- verdict */

export type Quality = 'good' | 'noisy' | 'quiet' | 'clipped'

/** What, if anything, the reciter should hear about how the take came out. */
export function judge(analysis: Analysis): Quality {
  if (analysis.clipped > 0.002) return 'clipped'
  if (analysis.voiceDb < -38) return 'quiet'
  if (analysis.snrDb < 22 || analysis.noiseFloorDb > -46) return 'noisy'
  return 'good'
}
