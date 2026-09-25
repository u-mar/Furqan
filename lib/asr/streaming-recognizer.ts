/**
 * Ties together the validated pieces (StreamingMelExtractor, CMVN, the
 * cache-aware FastConformer ONNX model, and the tokenizer) into one
 * incremental recognizer: push raw 16kHz PCM as it's captured, get back the
 * transcript decoded so far. Mirrors `streaming_inference_example.py`'s
 * chunking (CHUNK_MEL mel frames per inference step, cache tensors carried
 * forward) but incrementally instead of over one fully-buffered file.
 *
 * CTC collapse-repeats state (`prevId`) is carried across ALL frames of the
 * session, not reset per chunk — a repeat spanning a chunk boundary (last
 * frame of chunk N equals first frame of chunk N+1) must still collapse to
 * one token, so chunks cannot be decoded independently.
 */

import { StreamingMelExtractor } from './log-mel'
import { getCmvnStats, type CmvnStats } from './cmvn'
import { loadQuranTokenizer, CTC_BLANK_ID, type QuranTokenizer } from './tokenizer'
import { getCachedAsrModelBytes, isAsrModelDownloaded } from './model-cache'

const N_LAYERS = 17
const D_MODEL = 512
const LEFT_CACHE = 70
const TIME_CACHE = 8
// The reference script uses 112 (~1.12s/chunk); halving it to 56 (~0.56s)
// cuts live-reveal latency roughly in half. Verified in Node against real
// audio: 56 decodes byte-for-byte identical text to 112. Below 56 the model
// breaks down (48 gives visibly wrong text, 42/36 give nothing at all) — the
// cache-aware encoder needs at least this much per-step context, so do not
// lower this further without re-running that comparison.
const CHUNK_MEL = 56

type Ort = typeof import('onnxruntime-web/wasm')
type OrtTensor = InstanceType<Ort['Tensor']>

let sessionPromise: Promise<{ ort: Ort; session: import('onnxruntime-web/wasm').InferenceSession }> | null = null

/** The ONNX session is ~130MB and slow to instantiate — load it once and
 *  reuse across recognizer instances (e.g. across separate recitation
 *  attempts in the same app session). Reads the model from Cache Storage
 *  (populated by the user's explicit Settings download, see
 *  lib/asr/model-cache.ts) rather than fetching it live — the model isn't
 *  shipped as a static file, so there's nothing at that URL otherwise. */
function loadSession() {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      if (!isAsrModelDownloaded()) {
        throw new Error('ASR model not downloaded — open Settings to download it first')
      }
      const [ort, modelBytes] = await Promise.all([import('onnxruntime-web/wasm'), getCachedAsrModelBytes()])
      ort.env.wasm.wasmPaths = '/ort/'
      ort.env.wasm.numThreads = 1
      const session = await ort.InferenceSession.create(new Uint8Array(modelBytes), {
        executionProviders: ['wasm'],
      })
      return { ort, session }
    })().catch((err) => {
      sessionPromise = null // let a later attempt retry instead of caching the failure forever
      throw err
    })
  }
  return sessionPromise
}

function zeroCache(ort: Ort): { channel: OrtTensor; time: OrtTensor; len: OrtTensor } {
  return {
    channel: new ort.Tensor('float32', new Float32Array(N_LAYERS * LEFT_CACHE * D_MODEL), [
      1,
      N_LAYERS,
      LEFT_CACHE,
      D_MODEL,
    ]),
    time: new ort.Tensor('float32', new Float32Array(N_LAYERS * D_MODEL * TIME_CACHE), [
      1,
      N_LAYERS,
      D_MODEL,
      TIME_CACHE,
    ]),
    len: new ort.Tensor('int64', BigInt64Array.from([BigInt(0)]), [1]),
  }
}

export class StreamingRecognizer {
  private ort!: Ort
  private session!: import('onnxruntime-web/wasm').InferenceSession
  private cmvn!: CmvnStats
  private tokenizer!: QuranTokenizer
  private mel = new StreamingMelExtractor()
  private pendingFrames: Float32Array[] = []
  private cacheChannel!: OrtTensor
  private cacheTime!: OrtTensor
  private cacheLen!: OrtTensor
  private ids: number[] = []
  private prevId = -1
  private finished = false

  static async create(cmvnKind: 'tlog' | 'clean' = 'tlog'): Promise<StreamingRecognizer> {
    const r = new StreamingRecognizer()
    const [{ ort, session }, cmvn, tokenizer] = await Promise.all([
      loadSession(),
      getCmvnStats(cmvnKind),
      loadQuranTokenizer(),
    ])
    r.ort = ort
    r.session = session
    r.cmvn = cmvn
    r.tokenizer = tokenizer
    const zeros = zeroCache(ort)
    r.cacheChannel = zeros.channel
    r.cacheTime = zeros.time
    r.cacheLen = zeros.len
    return r
  }

  // Mic audio arrives in small worklet chunks every ~8ms, but a chunk that
  // triggers inference takes ~350-600ms (an `await`). Without serializing,
  // a chunk arriving mid-inference would call pushAudio again concurrently,
  // racing on the shared cache tensors. Every call is queued behind the
  // previous one so the actual work always runs one at a time, in order.
  private queue: Promise<unknown> = Promise.resolve()

  /** Appends newly-captured raw PCM (mono, 16kHz), runs inference on any
   *  newly-complete CHUNK_MEL-frame groups, and returns the transcript
   *  decoded so far (including this call's contribution, if any). */
  pushAudio(raw: Float32Array): Promise<string> {
    if (this.finished) throw new Error('StreamingRecognizer: pushAudio() called after finish()')
    const result = this.queue.then(() => this.pushAudioInner(raw))
    this.queue = result
    return result
  }

  private async pushAudioInner(raw: Float32Array): Promise<string> {
    const frames = this.mel.pushSamples(raw)
    this.applyCmvnInPlace(frames)
    this.pendingFrames.push(...frames)
    while (this.pendingFrames.length >= CHUNK_MEL) {
      const chunk = this.pendingFrames.splice(0, CHUNK_MEL)
      await this.runChunk(chunk)
    }
    return this.tokenizer.decode(this.ids)
  }

  /** Call once when recording stops. Flushes the tail of the mel extractor
   *  and runs one final (possibly shorter) chunk, returning the full
   *  transcript. No more `pushAudio` calls are allowed after this. */
  finish(): Promise<string> {
    if (this.finished) return this.queue.then(() => this.tokenizer.decode(this.ids))
    this.finished = true
    const result = this.queue.then(() => this.finishInner())
    this.queue = result
    return result
  }

  private async finishInner(): Promise<string> {
    const tailFrames = this.mel.flush()
    this.applyCmvnInPlace(tailFrames)
    this.pendingFrames.push(...tailFrames)
    while (this.pendingFrames.length > 0) {
      const chunk = this.pendingFrames.splice(0, CHUNK_MEL)
      await this.runChunk(chunk)
    }
    return this.tokenizer.decode(this.ids)
  }

  private applyCmvnInPlace(frames: Float32Array[]): void {
    const { mean, std } = this.cmvn
    for (const frame of frames) {
      for (let m = 0; m < frame.length; m++) frame[m] = (frame[m] - mean[m]) / (std[m] + 1e-5)
    }
  }

  private async runChunk(frames: Float32Array[]): Promise<void> {
    const chunkLen = frames.length
    const flat = new Float32Array(80 * chunkLen)
    for (let m = 0; m < 80; m++) {
      for (let t = 0; t < chunkLen; t++) flat[m * chunkLen + t] = frames[t][m]
    }
    const audio_signal = new this.ort.Tensor('float32', flat, [1, 80, chunkLen])
    const length = new this.ort.Tensor('int64', BigInt64Array.from([BigInt(chunkLen)]), [1])
    const results = await this.session.run({
      audio_signal,
      length,
      cache_last_channel: this.cacheChannel,
      cache_last_time: this.cacheTime,
      cache_last_channel_len: this.cacheLen,
    })
    this.cacheChannel = results.cache_last_channel_next as OrtTensor
    this.cacheTime = results.cache_last_time_next as OrtTensor
    this.cacheLen = results.cache_last_channel_next_len as OrtTensor

    const logprobs = results.logprobs
    const [, tOut, vocabPlusBlank] = logprobs.dims
    const data = logprobs.data as Float32Array | number[]
    for (let t = 0; t < tOut; t++) {
      let best = 0
      let bestVal = -Infinity
      const base = t * vocabPlusBlank
      for (let v = 0; v < vocabPlusBlank; v++) {
        const val = data[base + v]
        if (val > bestVal) {
          bestVal = val
          best = v
        }
      }
      if (best !== this.prevId && best !== CTC_BLANK_ID) this.ids.push(best)
      this.prevId = best
    }
  }
}
