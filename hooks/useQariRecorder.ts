'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { buildVoiceShaping } from '@/lib/audio-space'

/**
 * Recorder for Qari uploads.
 *
 * Keeps MediaRecorder's own compressed output rather than converting to WAV —
 * a minute of WAV is several megabytes, while Opus is well under one, which
 * matters when every recording is uploaded.
 *
 * What reaches the recorder is not the bare microphone but a cleaned, evened
 * voice (see lib/audio-space). That shaping has to happen on the way in —
 * re-encoding afterwards in the browser would mean replaying the whole take
 * in real time. The room tail is deliberately *not* baked in, so the space
 * can still be changed after the take; it is applied on playback instead.
 */

/**
 * Opus is transparent for a single voice well below this, and the ceiling
 * matters: with container overhead 128k put a full ten-minute take at ~11MB
 * against a 12MB upload limit. This leaves real headroom and sounds the same.
 */
const AUDIO_BITRATE = 96000

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
      return 'Microphone access was blocked. Allow it in your browser settings to record.'
    }
    if (err.name === 'NotFoundError') return 'No microphone was found on this device.'
  }
  return 'Could not start recording on this device.'
}

export interface QariRecorderState {
  recording: boolean
  /** Seconds elapsed in the current take. */
  elapsed: number
  /** 0–1, for the live level meter. */
  level: number
  /**
   * Whether the microphone itself is being pushed too hard (clipping, which no
   * processing can undo) or barely hears the reciter. Null when it is fine.
   */
  inputHint: 'loud' | 'quiet' | null
  error: string | null
  blob: Blob | null
  mimeType: string
  durationSec: number
}

const idle: QariRecorderState = {
  recording: false,
  elapsed: 0,
  level: 0,
  inputHint: null,
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

      const microphone = ctx.createMediaStreamSource(stream)
      const voice = await buildVoiceShaping(ctx, microphone)

      // The bare microphone, before any shaping, to tell the reciter when it
      // is too close (clipping) or too far away.
      const raw = ctx.createAnalyser()
      raw.fftSize = 2048
      microphone.connect(raw)
      const rawBuffer = new Float32Array(raw.fftSize)
      const sink = ctx.createMediaStreamDestination()
      voice.connect(sink)

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(sink.stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITRATE,
      })
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        teardown()
        setState({
          ...idle,
          blob,
          // Strip the codec suffix; the server only stores the base type.
          mimeType: type.split(';')[0],
          durationSec,
          elapsed: durationSec,
        })
      }

      /* Live level meter, tapped after the chain so it shows what is being
         recorded rather than what the microphone happens to hear. */
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      voice.connect(analyser)
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
        const now = Date.now()
        const seconds = Math.floor((now - startedAtRef.current) / 1000)

        raw.getFloatTimeDomainData(rawBuffer)
        let rawPeak = 0
        for (let i = 0; i < rawBuffer.length; i += 1) rawPeak = Math.max(rawPeak, Math.abs(rawBuffer[i]))
        if (rawPeak >= 0.97) lastClip = now
        // Anything above about -30dB counts as the reciter being heard.
        if (rawPeak >= 0.03) lastVoice = now
        const inputHint: QariRecorderState['inputHint'] =
          now - lastClip < 1500
            ? 'loud'
            : now - startedAtRef.current > 4000 && now - lastVoice > 4000
              ? 'quiet'
              : null

        setState((s) =>
          s.recording ? { ...s, level: peak, elapsed: seconds, inputHint } : s
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
  }, [maxSeconds, teardown])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const reset = useCallback(() => {
    stop()
    teardown()
    setState(idle)
  }, [stop, teardown])

  return { state, start, stop, reset, supported: typeof MediaRecorder !== 'undefined' }
}
