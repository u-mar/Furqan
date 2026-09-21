'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { tr } from '@/lib/i18n-core'
import { polishRecording, type PolishStage } from '@/lib/qari-polish'
import type { Quality } from '@/lib/qari-polish-dsp'

/**
 * Recorder for Qari uploads.
 *
 * Keeps MediaRecorder's own compressed output rather than converting to WAV —
 * a minute of WAV is several megabytes, while Opus is well under one, which
 * matters when every recording is uploaded.
 *
 * What is recorded is the bare microphone. When the reciter finishes it is
 * polished once (lib/qari-polish): levelled, trimmed, cleaned of room noise,
 * shaped, set to a standard loudness and saved as MP3. Doing it afterwards
 * rather than on the way in is what allows the loudness to be measured over
 * the whole take and the room noise to be judged before it is touched. The
 * room tail is deliberately *not* baked in, so the space can still be changed
 * after the take; it is applied on playback instead.
 */

/**
 * The untouched take is only an intermediate step, so it is kept generous:
 * it is decoded and processed straight away, and only the polished MP3 is uploaded.
 */
const AUDIO_BITRATE = 160000

/** In preference order; the first the browser supports wins. */
const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4', // Safari / iOS
  'audio/ogg;codecs=opus',
]

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return CANDIDATE_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

export interface PreparedRecording {
  stream: MediaStream
  context: AudioContext
}

/**
 * Ask for the microphone and wake the audio engine, straight from the tap.
 *
 * Done before the 3-2-1 countdown rather than after it: phones only let audio
 * start inside a tap, the permission prompt would otherwise land mid-count,
 * and the microphone gets a moment to settle before the first word.
 */
export async function prepareRecording(): Promise<PreparedRecording> {
  const context = new AudioContext()
  void context.resume().catch(() => {})
  // Fetch the noise expander now, so the take does not wait for it after 3-2-1.
  void context.audioWorklet?.addModule('/audio/qari-expander.js').catch(() => {})
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    })
    return { stream, context }
  } catch (err) {
    void context.close().catch(() => {})
    throw err
  }
}

export function releasePrepared(prepared: PreparedRecording | null): void {
  if (!prepared) return
  prepared.stream.getTracks().forEach((track) => track.stop())
  void prepared.context.close().catch(() => {})
}

/** Why the microphone could not be used, in words a reciter can act on. */
export function microphoneError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') {
      return tr('Microphone access was blocked. Allow it in your browser settings to record.')
    }
    if (err.name === 'NotFoundError') return tr('No microphone was found on this device.')
  }
  return tr('Could not start recording on this device.')
}

export interface QariRecorderState {
  recording: boolean
  /** Recording is held: the clock and the microphone are stopped until resumed. */
  paused: boolean
  /** Seconds elapsed in the current take. */
  elapsed: number
  /** 0–1, for the live level meter. */
  level: number
  /**
   * Whether the microphone itself is being pushed too hard (clipping, which no
   * processing can undo) or barely hears the reciter. Null when it is fine.
   */
  inputHint: 'loud' | 'quiet' | null
  /** The take has ended and is being polished; blob follows. */
  polishing: boolean
  polishProgress: number
  polishStage: PolishStage | null
  /** How the finished take came out, for a tip when it could have been better. */
  quality: Quality | null
  error: string | null
  blob: Blob | null
  mimeType: string
  durationSec: number
}

const idle: QariRecorderState = {
  recording: false,
  paused: false,
  elapsed: 0,
  level: 0,
  inputHint: null,
  polishing: false,
  polishProgress: 0,
  polishStage: null,
  quality: null,
  error: null,
  blob: null,
  mimeType: '',
  durationSec: 0,
}

export function useQariRecorder(maxSeconds = 600) {
  const [state, setState] = useState<QariRecorderState>(idle)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  /** Time spent paused, so the clock and the length count only what was recorded. */
  const pausedMsRef = useRef(0)
  const pausedAtRef = useRef<number | null>(null)
  const resumedAtRef = useRef(0)
  const activeMs = useCallback((now: number) => {
    const heldNow = pausedAtRef.current === null ? 0 : now - pausedAtRef.current
    return Math.max(0, now - startedAtRef.current - pausedMsRef.current - heldNow)
  }, [])
  /** Which take is being polished, so one that was thrown away cannot come back. */
  const polishRun = useRef(0)
  /** Set when the take is thrown away while recording, so its end is ignored. */
  const discarded = useRef(false)

  const teardown = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    analyserRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  useEffect(() => teardown, [teardown])

  const start = useCallback(async (prepared?: PreparedRecording) => {
    if (recorderRef.current) return
    discarded.current = false
    pausedMsRef.current = 0
    pausedAtRef.current = null

    try {
      // All three of these are tuned for phone calls. On a recitation they
      // pump the level, swallow the tail of each phrase and add a warbling
      // artefact — the single biggest cause of a take sounding cheap.
      const stream =
        prepared?.stream ??
        (await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        }))
      streamRef.current = stream

      const ctx = prepared?.context ?? new AudioContext()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      // The bare microphone: it drives the level meter and tells the reciter
      // when it is too close (clipping) or too far away.
      const microphone = ctx.createMediaStreamSource(stream)
      const raw = ctx.createAnalyser()
      raw.fftSize = 2048
      microphone.connect(raw)
      const rawBuffer = new Float32Array(raw.fftSize)

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITRATE,
      })
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        if (discarded.current) return
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const raw = new Blob(chunksRef.current, { type })
        const durationSec = Math.max(1, Math.round(activeMs(Date.now()) / 1000))
        teardown()
        const run = ++polishRun.current
        setState({ ...idle, polishing: true, elapsed: durationSec })

        // Polish it; if anything about that fails, the take itself is kept
        // rather than lost.
        polishRecording(raw, (fraction, stage) =>
          setState((s) => (s.polishing && polishRun.current === run ? { ...s, polishProgress: fraction, polishStage: stage } : s))
        )
          .then((done) =>
            polishRun.current === run &&
            setState({
              ...idle,
              blob: done.blob,
              mimeType: done.mimeType,
              durationSec: done.durationSec,
              elapsed: durationSec,
              quality: done.quality,
            })
          )
          .catch(() =>
            polishRun.current === run &&
            setState({
              ...idle,
              blob: raw,
              // Strip the codec suffix; the server only stores the base type.
              mimeType: type.split(';')[0],
              durationSec,
              elapsed: durationSec,
            })
          )
      }

      /* Live level meter, from the microphone. It is quieter than the polished
         take will be, so it is lifted to sit in the middle of the display. */
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      microphone.connect(analyser)
      analyserRef.current = analyser

      const buffer = new Uint8Array(analyser.frequencyBinCount)
      let lastClip = -Infinity
      let lastVoice = 0
      const tick = () => {
        const node = analyserRef.current
        if (!node) return
        node.getByteTimeDomainData(buffer)
        let peak = 0
        for (let i = 0; i < buffer.length; i += 1) {
          peak = Math.max(peak, Math.abs(buffer[i] - 128) / 128)
        }
        peak = Math.min(1, peak * 2.2)
        const now = Date.now()
        const seconds = Math.floor(activeMs(now) / 1000)
        const held = pausedAtRef.current !== null
        if (resumedAtRef.current > lastVoice) lastVoice = resumedAtRef.current

        raw.getFloatTimeDomainData(rawBuffer)
        let rawPeak = 0
        for (let i = 0; i < rawBuffer.length; i += 1) rawPeak = Math.max(rawPeak, Math.abs(rawBuffer[i]))
        if (rawPeak >= 0.97) lastClip = now
        // Anything above about -30dB counts as the reciter being heard.
        if (rawPeak >= 0.03) lastVoice = now
        const inputHint: QariRecorderState['inputHint'] = held
          ? null
          : now - lastClip < 1500
            ? 'loud'
            : activeMs(now) > 4000 && now - lastVoice > 4000
              ? 'quiet'
              : null

        setState((s) =>
          s.recording ? { ...s, level: held ? 0 : peak, elapsed: seconds, inputHint } : s
        )
        if (seconds >= maxSeconds) {
          recorderRef.current?.stop()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      startedAtRef.current = Date.now()
      lastVoice = startedAtRef.current
      recorder.start()
      setState({ ...idle, recording: true })
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      teardown()
      setState({ ...idle, error: microphoneError(err) })
    }
  }, [maxSeconds, teardown, activeMs])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const pause = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    recorder.pause()
    pausedAtRef.current = Date.now()
    setState((s) => (s.recording ? { ...s, paused: true, level: 0 } : s))
  }, [])

  const resume = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    recorder.resume()
    const now = Date.now()
    if (pausedAtRef.current !== null) pausedMsRef.current += now - pausedAtRef.current
    pausedAtRef.current = null
    resumedAtRef.current = now
    setState((s) => (s.recording ? { ...s, paused: false } : s))
  }, [])

  const reset = useCallback(() => {
    polishRun.current += 1
    discarded.current = true
    stop()
    teardown()
    setState(idle)
  }, [stop, teardown])

  return { state, start, stop, pause, resume, reset, supported: typeof MediaRecorder !== 'undefined' }
}
