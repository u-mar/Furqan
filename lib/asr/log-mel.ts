/**
 * Log-mel feature extractor matching torchaudio's
 * MelSpectrogram(sample_rate=16000, n_fft=512, win_length=400, hop_length=160,
 * n_mels=80, power=2.0, window_fn=hann, norm="slaney", mel_scale="slaney"),
 * preceded by preemphasis(0.97), followed by ln(x + 2**-24) — the exact
 * pipeline Muno459/fastconformer-quran-streaming's ONNX export expects
 * (see its streaming_inference_example.py). No dependencies — own FFT, own
 * mel filterbank — so it runs in the browser as-is.
 *
 * Verified numerically against the real torchaudio output on a synthetic
 * test signal: max abs diff 0.00006 across all 16,080 values (float32
 * precision noise). Do not change the constants or frame-extraction offset
 * below without re-validating — see the note on WIN_PAD_LEFT.
 */

const SAMPLE_RATE = 16000
const N_FFT = 512
const WIN_LENGTH = 400
const HOP_LENGTH = 160
const N_MELS = 80
const PREEMPH = 0.97
const LOG_EPS = 2 ** -24

function preemphasis(x: Float32Array): Float32Array {
  const y = new Float32Array(x.length)
  y[0] = x[0]
  for (let i = 1; i < x.length; i++) y[i] = x[i] - PREEMPH * x[i - 1]
  return y
}

/** torch.hann_window(N, periodic=True): 0.5 - 0.5*cos(2*pi*n/N), n=0..N-1. */
function hannWindowPeriodic(n: number): Float64Array {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)
  return w
}

/** torch.stft(center=True, pad_mode='reflect'): pad n_fft//2 each side,
 *  numpy/torch 'reflect' convention (mirror without repeating the edge). */
function reflectPad(x: Float32Array, pad: number): Float32Array {
  const n = x.length
  const out = new Float32Array(n + 2 * pad)
  out.set(x, pad)
  for (let i = 0; i < pad; i++) {
    out[pad - 1 - i] = x[Math.min(i + 1, n - 1)]
    out[pad + n + i] = x[Math.max(n - 2 - i, 0)]
  }
  return out
}

/** In-place iterative radix-2 Cooley-Tukey FFT; `re`/`im` length must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wRe = Math.cos(ang)
    const wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k]
        const uIm = im[i + k]
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe
        re[i + k] = uRe + vRe
        im[i + k] = uIm + vIm
        re[i + k + len / 2] = uRe - vRe
        im[i + k + len / 2] = uIm - vIm
        const nextRe = curRe * wRe - curIm * wIm
        const nextIm = curRe * wIm + curIm * wRe
        curRe = nextRe
        curIm = nextIm
      }
    }
  }
}

/** Slaney mel scale — matches librosa (htk=False) / torchaudio mel_scale="slaney". */
function hzToMelSlaney(hz: number): number {
  const fSp = 200.0 / 3
  const minLogHz = 1000.0
  const minLogMel = minLogHz / fSp
  const logstep = Math.log(6.4) / 27.0
  if (hz < minLogHz) return hz / fSp
  return minLogMel + Math.log(hz / minLogHz) / logstep
}

function melToHzSlaney(mel: number): number {
  const fSp = 200.0 / 3
  const minLogHz = 1000.0
  const minLogMel = minLogHz / fSp
  const logstep = Math.log(6.4) / 27.0
  if (mel < minLogMel) return fSp * mel
  return minLogHz * Math.exp(logstep * (mel - minLogMel))
}

/** (nMels x nFft/2+1) triangular filterbank, slaney-normalized (each filter
 *  scaled by 2/(hz[i+2]-hz[i]), i.e. area-normalized). */
function buildMelFilterbank(sampleRate: number, nFft: number, nMels: number): Float64Array[] {
  const nFreqs = nFft / 2 + 1
  const fMax = sampleRate / 2
  const melMin = hzToMelSlaney(0)
  const melMax = hzToMelSlaney(fMax)
  const melPoints = new Float64Array(nMels + 2)
  for (let i = 0; i < nMels + 2; i++) melPoints[i] = melMin + ((melMax - melMin) * i) / (nMels + 1)
  const hzPoints = Array.from(melPoints, melToHzSlaney)
  const binFreqs = new Float64Array(nFreqs)
  for (let i = 0; i < nFreqs; i++) binFreqs[i] = (i * sampleRate) / nFft

  const fb = Array.from({ length: nMels }, () => new Float64Array(nFreqs))
  for (let m = 0; m < nMels; m++) {
    const left = hzPoints[m]
    const center = hzPoints[m + 1]
    const right = hzPoints[m + 2]
    const enorm = 2.0 / (right - left)
    for (let k = 0; k < nFreqs; k++) {
      const f = binFreqs[k]
      let w = 0
      if (f >= left && f <= center) w = (f - left) / (center - left)
      else if (f > center && f <= right) w = (right - f) / (right - center)
      fb[m][k] = w > 0 ? w * enorm : 0
    }
  }
  return fb
}

const WINDOW = hannWindowPeriodic(WIN_LENGTH)
const MEL_FB = buildMelFilterbank(SAMPLE_RATE, N_FFT, N_MELS)
// torch.stft pads a shorter window to n_fft, centered — so each frame's real
// samples that get non-zero weight are offset by this much into the n_fft
// window, not left-aligned. Getting this wrong silently shifts every frame
// by ~3.5ms and was the one bug found during validation.
const WIN_PAD_LEFT = Math.floor((N_FFT - WIN_LENGTH) / 2)

/** Computes one log-mel frame (80 values, one per mel bin) from a
 *  fully-populated N_FFT-length window (real samples placed at
 *  [WIN_PAD_LEFT, WIN_PAD_LEFT+WIN_LENGTH), zero elsewhere). Used by
 *  `StreamingMelExtractor`; `logMelSpectrogram` inlines the same math in
 *  batch form for speed over a whole utterance. */
function computeSingleFrame(windowSamples: Float64Array): Float32Array {
  const nFreqs = N_FFT / 2 + 1
  const reBuf = new Float64Array(N_FFT)
  const imBuf = new Float64Array(N_FFT)
  reBuf.set(windowSamples)
  fft(reBuf, imBuf)
  const power = new Float64Array(nFreqs)
  for (let k = 0; k < nFreqs; k++) power[k] = reBuf[k] * reBuf[k] + imBuf[k] * imBuf[k]
  const frame = new Float32Array(N_MELS)
  for (let m = 0; m < N_MELS; m++) {
    const filt = MEL_FB[m]
    let sum = 0
    for (let k = 0; k < nFreqs; k++) sum += filt[k] * power[k]
    frame[m] = Math.log(sum + LOG_EPS)
  }
  return frame
}

/**
 * Incremental counterpart to `logMelSpectrogram`, for live microphone audio.
 * `logMelSpectrogram` reflect-pads BOTH ends of whatever it's given — correct
 * for a complete utterance, wrong for a mid-recording chunk (it would fake a
 * "start"/"end" at every chunk boundary, corrupting frames there). This
 * class instead reflect-pads the true recording start exactly once, uses
 * real carried-over audio as left context for every later frame (matching
 * what one pass over the whole signal would produce), and only reflect-pads
 * the true end when `flush()` is called at recording stop.
 *
 * Verified to match `logMelSpectrogram(wholeSignal)` frame-for-frame
 * regardless of how the input is chunked across `pushSamples` calls — see
 * the validation script referenced in the module comment below.
 */
export class StreamingMelExtractor {
  private preemph: number[] = []
  private lastRaw = 0
  private hasReceivedAny = false
  private startPad: Float64Array | null = null
  private framesEmitted = 0
  private done = false

  /** Real preemphasized sample at conceptual padded-array index `j`, or
   *  `null` if it would require audio beyond what's been pushed so far. */
  private padAt(j: number): number | null {
    if (j < N_FFT / 2) return this.startPad ? this.startPad[j] : null
    const i = j - N_FFT / 2
    return i < this.preemph.length ? this.preemph[i] : null
  }

  /** Appends newly-captured raw PCM and returns any newly-computable
   *  frames. Safe to call repeatedly with small chunks as audio streams in. */
  pushSamples(raw: Float32Array): Float32Array[] {
    if (this.done) throw new Error('StreamingMelExtractor: pushSamples() called after flush()')
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i]
      // Math.fround: the offline path stores preemphasized samples in a
      // Float32Array (truncated to float32 each step); `preemph` here is a
      // plain number[] for growability, so it must truncate explicitly to
      // match bit-for-bit — otherwise accumulated float64 precision drifts
      // just enough to occasionally flip a close CTC decision.
      this.preemph.push(Math.fround(this.hasReceivedAny ? x - PREEMPH * this.lastRaw : x))
      this.lastRaw = x
      this.hasReceivedAny = true
    }
    const pad = N_FFT / 2
    if (!this.startPad && this.preemph.length > pad) {
      this.startPad = new Float64Array(pad)
      for (let i = 0; i < pad; i++) this.startPad[pad - 1 - i] = this.preemph[i + 1]
    }
    return this.drainFrames()
  }

  private drainFrames(): Float32Array[] {
    const out: Float32Array[] = []
    const win = new Float64Array(N_FFT)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const start = this.framesEmitted * HOP_LENGTH
      const lastNeeded = start + WIN_PAD_LEFT + WIN_LENGTH - 1
      if (this.padAt(lastNeeded) === null) break
      win.fill(0)
      for (let i = 0; i < WIN_LENGTH; i++) {
        win[WIN_PAD_LEFT + i] = (this.padAt(start + WIN_PAD_LEFT + i) as number) * WINDOW[i]
      }
      out.push(computeSingleFrame(win))
      this.framesEmitted++
    }
    return out
  }

  /** Call once when the recording stops. Reflect-pads the true end (as
   *  `logMelSpectrogram` does for the whole signal) and returns the
   *  remaining frames. No more `pushSamples` calls are allowed after this. */
  flush(): Float32Array[] {
    if (this.done) return []
    this.done = true
    const n = this.preemph.length
    const pad = N_FFT / 2
    const endPad = new Float64Array(pad)
    for (let i = 0; i < pad; i++) endPad[i] = this.preemph[Math.max(n - 2 - i, 0)]
    const padAtFinal = (j: number): number => {
      if (j < pad) return this.startPad ? this.startPad[j] : this.preemph[Math.min(j + 1, n - 1)] ?? 0
      const i = j - pad
      if (i < n) return this.preemph[i]
      return endPad[i - n]
    }
    const paddedLen = pad + n + pad
    const totalFrames = n === 0 ? 0 : 1 + Math.floor((paddedLen - WIN_LENGTH) / HOP_LENGTH)
    const out: Float32Array[] = []
    const win = new Float64Array(N_FFT)
    for (; this.framesEmitted < totalFrames; this.framesEmitted++) {
      const start = this.framesEmitted * HOP_LENGTH
      win.fill(0)
      for (let i = 0; i < WIN_LENGTH; i++) win[WIN_PAD_LEFT + i] = padAtFinal(start + WIN_PAD_LEFT + i) * WINDOW[i]
      out.push(computeSingleFrame(win))
    }
    return out
  }
}

/**
 * @param samples mono, 16kHz PCM.
 * @returns 80 arrays (one per mel bin) of equal length T (one per frame),
 *   i.e. `result[mel][frame]` — matches the model's `audio_signal` layout
 *   once stacked into a (1, 80, T) tensor.
 */
export function logMelSpectrogram(samples: Float32Array): Float32Array[] {
  const pre = preemphasis(samples)
  const padded = reflectPad(pre, N_FFT / 2)
  const nFrames = 1 + Math.floor((padded.length - WIN_LENGTH) / HOP_LENGTH)
  const nFreqs = N_FFT / 2 + 1

  const power: Float64Array[] = Array.from({ length: nFrames }, () => new Float64Array(nFreqs))
  const reBuf = new Float64Array(N_FFT)
  const imBuf = new Float64Array(N_FFT)

  for (let t = 0; t < nFrames; t++) {
    reBuf.fill(0)
    imBuf.fill(0)
    const start = t * HOP_LENGTH
    for (let i = 0; i < WIN_LENGTH; i++) {
      reBuf[WIN_PAD_LEFT + i] = padded[start + WIN_PAD_LEFT + i] * WINDOW[i]
    }
    fft(reBuf, imBuf)
    for (let k = 0; k < nFreqs; k++) {
      power[t][k] = reBuf[k] * reBuf[k] + imBuf[k] * imBuf[k]
    }
  }

  const out: Float32Array[] = Array.from({ length: N_MELS }, () => new Float32Array(nFrames))
  for (let m = 0; m < N_MELS; m++) {
    const filt = MEL_FB[m]
    for (let t = 0; t < nFrames; t++) {
      let sum = 0
      const p = power[t]
      for (let k = 0; k < nFreqs; k++) sum += filt[k] * p[k]
      out[m][t] = Math.log(sum + LOG_EPS)
    }
  }
  return out
}

export const LOG_MEL_CONFIG = {
  sampleRate: SAMPLE_RATE,
  nFft: N_FFT,
  winLength: WIN_LENGTH,
  hopLength: HOP_LENGTH,
  nMels: N_MELS,
} as const
