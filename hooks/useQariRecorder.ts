'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Recorder for Qari uploads.
 *
 * Keeps MediaRecorder's own compressed output rather than converting to WAV —
 * a minute of WAV is several megabytes, while Opus is well under one, which
 * matters when every recording is uploaded.
 */

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

export interface QariRecorderState {
  recording: boolean
  /** Seconds elapsed in the current take. */
  elapsed: number
  /** 0–1, for the live level meter. */
  level: number
  error: string | null
  blob: Blob | null
  mimeType: string
  durationSec: number
}

const idle: QariRecorderState = {
  recording: false,
  elapsed: 0,
  level: 0,
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

  const start = useCallback(async () => {
    if (recorderRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
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

      /* Live level meter */
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyserRef.current = analyser

      const buffer = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        const node = analyserRef.current
        if (!node) return
        node.getByteTimeDomainData(buffer)
        let peak = 0
        for (let i = 0; i < buffer.length; i += 1) {
          peak = Math.max(peak, Math.abs(buffer[i] - 128) / 128)
        }
        const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setState((s) =>
          s.recording ? { ...s, level: peak, elapsed: seconds } : s
        )
        if (seconds >= maxSeconds) {
          recorderRef.current?.stop()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      startedAtRef.current = Date.now()
      recorder.start()
      setState({ ...idle, recording: true })
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      teardown()
      const denied = err instanceof DOMException && err.name === 'NotAllowedError'
      setState({
        ...idle,
        error: denied
          ? 'Microphone access was blocked. Allow it in your browser settings to record.'
          : 'Could not start recording on this device.',
      })
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
