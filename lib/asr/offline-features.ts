/**
 * Log-mel features for the OFFLINE Muno459/fastconformer-quran model (the one
 * that hears a whole recording at once, unlike the streaming model that
 * voice search used). Same FFT and mel filterbank as log-mel.ts, which was
 * checked against torchaudio; what differs is how the model was trained to
 * be fed, and toolkits disagree on three details, so each is a setting
 * rather than a guess:
 *
 *   window     'symmetric' (NeMo) | 'periodic' (torchaudio)
 *   pad        'constant'  (NeMo) | 'reflect'
 *   normalize  'per_feature' (each mel bin scaled to mean 0, std 1 over the
 *              recording — what NeMo offline models do) | 'none'
 *
 * The asr test page (/qari/asr-test) tries every combination on a clip you
 * know and keeps the one the model is most confident with.
 */

import { LOG_MEL_CONFIG, MEL_FB, fft } from './log-mel'

export interface FeatureSettings {
  window: 'symmetric' | 'periodic'
  pad: 'constant' | 'reflect'
  normalize: 'per_feature' | 'none'
}

/**
 * NeMo's own defaults, which is what an offline NeMo model is trained with.
 * Checked against the real model: with these it transcribes Quran recitations
 * word for word, and without per-feature normalisation it hears nothing.
 */
export const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  window: 'symmetric',
  pad: 'constant',
  normalize: 'per_feature',
}

const { nFft: N_FFT, winLength: WIN_LENGTH, hopLength: HOP_LENGTH, nMels: N_MELS } = LOG_MEL_CONFIG
const PREEMPH = 0.97
const LOG_EPS = 2 ** -24
const NORM_EPS = 1e-5
const WIN_PAD_LEFT = Math.floor((N_FFT - WIN_LENGTH) / 2)

const windows: Record<FeatureSettings['window'], Float64Array> = {
  periodic: Float64Array.from({ length: WIN_LENGTH }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WIN_LENGTH)),
  symmetric: Float64Array.from({ length: WIN_LENGTH }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN_LENGTH - 1))),
}

// v2: the first calibration page ranked a model that heard nothing as the most certain, so settings saved from it are not trusted.
const SETTINGS_KEY = 'muyassar_qari_asr_features_v2'

/** The settings the calibration page found best, or NeMo's defaults. */
export function loadFeatureSettings(): FeatureSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null') as Partial<FeatureSettings> | null
    if (saved) {
      return {
        window: saved.window === 'periodic' ? 'periodic' : 'symmetric',
        pad: saved.pad === 'reflect' ? 'reflect' : 'constant',
        normalize: saved.normalize === 'none' ? 'none' : 'per_feature',
      }
    }
  } catch {
    /* defaults */
  }
  return DEFAULT_FEATURE_SETTINGS
}

export function saveFeatureSettings(settings: FeatureSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export const FRAME_SECONDS = HOP_LENGTH / LOG_MEL_CONFIG.sampleRate

/**
 * @param samples mono 16 kHz PCM
 * @returns row-major (N_MELS x frames) data, ready to be a (1, 80, frames) tensor
 */
export function offlineLogMel(
  samples: Float32Array,
  settings: FeatureSettings = DEFAULT_FEATURE_SETTINGS
): { data: Float32Array; frames: number } {
  const n = samples.length
  if (n === 0) return { data: new Float32Array(0), frames: 0 }

  // Preemphasis, then the edges padded by n_fft/2 as torch.stft(center=True) does.
  const pad = N_FFT / 2
  const padded = new Float32Array(n + 2 * pad)
  padded[pad] = samples[0]
  for (let i = 1; i < n; i++) padded[pad + i] = samples[i] - PREEMPH * samples[i - 1]
  if (settings.pad === 'reflect' && n > pad) {
    for (let i = 0; i < pad; i++) {
      padded[pad - 1 - i] = padded[pad + i + 1]
      padded[pad + n + i] = padded[pad + n - 2 - i]
    }
  }

  const frames = 1 + Math.floor((padded.length - N_FFT) / HOP_LENGTH)
  const nFreqs = N_FFT / 2 + 1
  const window = windows[settings.window]
  const re = new Float64Array(N_FFT)
  const im = new Float64Array(N_FFT)
  const power = new Float64Array(nFreqs)
  const out = new Float32Array(N_MELS * frames)

  for (let t = 0; t < frames; t++) {
    re.fill(0)
    im.fill(0)
    const start = t * HOP_LENGTH
    for (let i = 0; i < WIN_LENGTH; i++) re[WIN_PAD_LEFT + i] = padded[start + WIN_PAD_LEFT + i] * window[i]
    fft(re, im)
    for (let k = 0; k < nFreqs; k++) power[k] = re[k] * re[k] + im[k] * im[k]
    for (let m = 0; m < N_MELS; m++) {
      const filter = MEL_FB[m]
      let sum = 0
      for (let k = 0; k < nFreqs; k++) sum += filter[k] * power[k]
      out[m * frames + t] = Math.log(sum + LOG_EPS)
    }
  }

  if (settings.normalize === 'per_feature' && frames > 1) {
    for (let m = 0; m < N_MELS; m++) {
      const row = out.subarray(m * frames, (m + 1) * frames)
      let mean = 0
      for (let t = 0; t < frames; t++) mean += row[t]
      mean /= frames
      let variance = 0
      for (let t = 0; t < frames; t++) variance += (row[t] - mean) ** 2
      const std = Math.sqrt(variance / (frames - 1)) + NORM_EPS
      for (let t = 0; t < frames; t++) row[t] = (row[t] - mean) / std
    }
  }
  return { data: out, frames }
}
