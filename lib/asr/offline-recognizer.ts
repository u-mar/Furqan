/**
 * Listens to a whole recording with the offline Quran speech model, on the
 * phone, and returns the words it heard with when each starts and ends.
 *
 * Long recordings are cut into pieces of at most MAX_CHUNK_SEC, at the
 * quietest moment near each cut (reciters pause between ayat), so memory
 * stays flat however long the recitation is; each piece's times are moved back
 * into place afterwards. Mirrors services/nadir-asr/recognizer.py.
 */

import { loadQuranTokenizer, type QuranTokenizer } from './tokenizer'
import { DEFAULT_FEATURE_SETTINGS, FRAME_SECONDS, offlineLogMel, type FeatureSettings } from './offline-features'
import { getQariAsrModelBytes } from './offline-model-cache'
import { tr } from '@/lib/i18n-core'

export const ASR_SAMPLE_RATE = 16_000
const MAX_CHUNK_SEC = 40
const MIN_CHUNK_SEC = 25

export interface RecognizedWord {
  word: string
  start: number
  end: number
}

export interface Recognition {
  text: string
  words: RecognizedWord[]
  durationSec: number
  /**
   * 0–1: how sure the model was about the words it heard, and 0 when it heard
   * none. (Counting silence would make a model that hears nothing look
   * certain, which is exactly what happens with the wrong audio settings.)
   */
  confidence: number
  /** Output steps that carried a word piece, and their combined confidence: what `confidence` is made of. */
  heardSteps?: number
  heardConfidence?: number
}

type Ort = typeof import('onnxruntime-web/wasm')
type Session = import('onnxruntime-web/wasm').InferenceSession

let sessionPromise: Promise<{ ort: Ort; session: Session; float16: boolean }> | null = null

/** Loads the model once and keeps it for the rest of the visit. */
export function loadOfflineSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const [ort, bytes] = await Promise.all([import('onnxruntime-web/wasm'), getQariAsrModelBytes()])
      ort.env.wasm.wasmPaths = '/ort/'
      ort.env.wasm.numThreads = 1
      // Inference in a worker, so the screen stays alive while a recording is listened to.
      ort.env.wasm.proxy = true
      const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] })
      const meta = (session as unknown as { inputMetadata?: { name: string; type?: string }[] }).inputMetadata
      const float16 = Boolean(meta?.[0]?.type && String(meta[0].type).includes('float16'))
      return { ort, session, float16 }
    })().catch((err) => {
      sessionPromise = null
      throw err
    })
  }
  return sessionPromise
}

/** Lets go of the loaded model (it is large), e.g. after it is removed. */
export function releaseOfflineSession(): void {
  const pending = sessionPromise
  sessionPromise = null
  void pending?.then(({ session }) => session.release()).catch(() => {})
}

/** Pieces of the recording: [start sample, samples], cut at the quietest 100 ms between MIN and MAX seconds in. */
export function splitRecording(samples: Float32Array): { start: number; samples: Float32Array }[] {
  const max = MAX_CHUNK_SEC * ASR_SAMPLE_RATE
  const min = MIN_CHUNK_SEC * ASR_SAMPLE_RATE
  const step = ASR_SAMPLE_RATE / 10
  const pieces: { start: number; samples: Float32Array }[] = []
  let start = 0
  while (samples.length - start > max) {
    let bestAt = start + min
    let bestEnergy = Infinity
    for (let at = start + min; at + step <= start + max; at += step) {
      let energy = 0
      for (let i = at; i < at + step; i++) energy += samples[i] * samples[i]
      if (energy < bestEnergy) {
        bestEnergy = energy
        bestAt = at
      }
    }
    const cut = bestAt + step / 2
    pieces.push({ start, samples: samples.subarray(start, cut) })
    start = cut
  }
  if (samples.length - start > 0) pieces.push({ start, samples: samples.subarray(start) })
  return pieces
}

const yieldToScreen = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

export async function recognize(
  samples: Float32Array,
  options: { settings?: FeatureSettings; onProgress?: (fraction: number) => void; signal?: { cancelled: boolean } } = {}
): Promise<Recognition> {
  const settings = options.settings ?? DEFAULT_FEATURE_SETTINGS
  const [{ ort, session, float16 }, tokenizer] = await Promise.all([loadOfflineSession(), loadQuranTokenizer()])
  if (float16) {
    throw new Error(tr('This model is fp16, which phones cannot run. Use the fp32 or int8 model.'))
  }

  const pieces = splitRecording(samples)
  const words: RecognizedWord[] = []
  const texts: string[] = []
  let heardSteps = 0
  let heardConfidence = 0

  for (let p = 0; p < pieces.length; p++) {
    if (options.signal?.cancelled) throw new Error('cancelled')
    const piece = pieces[p]
    const part = await recognizePiece(ort, session, tokenizer, piece.samples, settings)
    const offset = piece.start / ASR_SAMPLE_RATE
    for (const w of part.words) words.push({ word: w.word, start: round(w.start + offset), end: round(w.end + offset) })
    if (part.text) texts.push(part.text)
    heardSteps += part.heardSteps ?? 0
    heardConfidence += part.heardConfidence ?? 0
    options.onProgress?.((p + 1) / pieces.length)
    await yieldToScreen()
  }

  return {
    text: texts.join(' '),
    words,
    durationSec: round(samples.length / ASR_SAMPLE_RATE),
    confidence: heardSteps ? heardConfidence / heardSteps : 0,
  }
}

const round = (n: number) => Math.round(n * 1000) / 1000

async function recognizePiece(
  ort: Ort,
  session: Session,
  tokenizer: QuranTokenizer,
  samples: Float32Array,
  settings: FeatureSettings
): Promise<Recognition> {
  const { data, frames } = offlineLogMel(samples, settings)
  if (frames < 8) return { text: '', words: [], durationSec: 0, confidence: 0, heardSteps: 0, heardConfidence: 0 }

  const feeds: Record<string, InstanceType<Ort['Tensor']>> = {
    audio_signal: new ort.Tensor('float32', data, [1, 80, frames]),
  }
  if (session.inputNames.includes('length')) {
    feeds.length = new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1])
  }
  const outputName = session.outputNames.includes('logprobs') ? 'logprobs' : session.outputNames[0]
  const results = await session.run(feeds)
  const out = results[outputName]
  const dims = out.dims
  const values = out.data as Float32Array

  // (1, T, vocab+blank), or the transposed (1, vocab+blank, T) some exports give.
  const transposed = dims[1] === 1025 && dims[2] !== 1025
  const vocabSize = transposed ? dims[1] : dims[2]
  const steps = transposed ? dims[2] : dims[1]
  const blank = vocabSize - 1
  const at = (t: number, v: number) => (transposed ? values[v * steps + t] : values[t * vocabSize + v])

  // Each output step stands for this much audio (the encoder shortens time ~8x).
  const stepSeconds = (frames / steps) * FRAME_SECONDS

  const tokens: { id: number; first: number; last: number }[] = []
  let previous = -1
  let heardSteps = 0
  let heardConfidence = 0
  for (let t = 0; t < steps; t++) {
    let best = 0
    let bestValue = -Infinity
    for (let v = 0; v < vocabSize; v++) {
      const value = at(t, v)
      if (value > bestValue) {
        bestValue = value
        best = v
      }
    }
    // The probability of the winner, whether the model gave log-probabilities or raw scores.
    let norm = 0
    for (let v = 0; v < vocabSize; v++) norm += Math.exp(at(t, v) - bestValue)
    if (best !== blank) {
      heardSteps += 1
      heardConfidence += 1 / norm
    }

    if (best !== blank) {
      if (best !== previous) tokens.push({ id: best, first: t, last: t })
      else tokens[tokens.length - 1].last = t
    }
    previous = best
  }

  const words: RecognizedWord[] = []
  let group: typeof tokens = []
  const flush = () => {
    if (!group.length) return
    const word = tokenizer.decode(group.map((g) => g.id)).trim()
    if (word) words.push({ word, start: round(group[0].first * stepSeconds), end: round((group[group.length - 1].last + 1) * stepSeconds) })
  }
  for (const token of tokens) {
    if (tokenizer.startsWord(token.id) && group.length) {
      flush()
      group = []
    }
    group.push(token)
  }
  flush()

  return {
    text: tokenizer.decode(tokens.map((t) => t.id)).trim(),
    words,
    durationSec: samples.length / ASR_SAMPLE_RATE,
    confidence: heardSteps ? heardConfidence / heardSteps : 0,
    heardSteps,
    heardConfidence,
  }
}

/** Decodes a recording (WebM, M4A…) to 16 kHz mono, as the model wants it. */
export async function decodeRecording(blob: Blob): Promise<Float32Array> {
  // An offline context decodes without asking for the speaker, and resamples to its own rate.
  const context = new OfflineAudioContext(1, 1, ASR_SAMPLE_RATE)
  const decoded = await context.decodeAudioData(await blob.arrayBuffer())
  if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice()
  const mono = new Float32Array(decoded.length)
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const channel = decoded.getChannelData(c)
    for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / decoded.numberOfChannels
  }
  return mono
}
