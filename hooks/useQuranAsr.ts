'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isMicCaptureSupported, startMicCapture, type MicCapture } from '@/lib/asr/mic-capture'
import { isAsrModelDownloaded } from '@/lib/asr/model-cache'
import { StreamingRecognizer } from '@/lib/asr/streaming-recognizer'
import { tr } from '@/lib/i18n-core'
import type { VoiceInputState } from './useArabicVoiceInput'

/**
 * Drop-in replacement for `useArabicVoiceInput`, backed by the real
 * on-device Quran ASR model (FastConformer, streaming) instead of the
 * browser's generic Web Speech API. Same `onResult`/`onInterim` contract —
 * `onInterim` fires with the transcript decoded so far as audio streams in,
 * `onResult` fires once with the final transcript after `stop()` — so
 * nothing downstream (search, the live mushaf reveal) needs to change to
 * use it instead of `useArabicVoiceInput`.
 *
 * Adds one thing `useArabicVoiceInput` doesn't have: `error`, a human
 * message for why `state` is `'unsupported'` — the mic API itself missing
 * vs. the model just not being downloaded yet are different situations that
 * deserve different UI, so a caller that cares can show it (e.g. a link to
 * Settings); a caller that doesn't is unaffected, since it's an addition.
 */
export function useQuranAsr(onResult: (text: string) => void, onInterim?: (text: string) => void) {
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)
  const captureRef = useRef<MicCapture | null>(null)
  const recognizerRef = useRef<StreamingRecognizer | null>(null)
  const sessionIdRef = useRef(0)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onInterimRef = useRef(onInterim)
  onInterimRef.current = onInterim

  useEffect(() => {
    if (!isMicCaptureSupported()) {
      setState('unsupported')
      setError(tr('Voice not supported here'))
    } else if (!isAsrModelDownloaded()) {
      setState('unsupported')
      setError(tr('Download the speech recognition model in Settings to use your voice.'))
    }
  }, [])

  useEffect(() => () => captureRef.current?.stop(), [])

  const start = useCallback(() => {
    if (!isMicCaptureSupported()) {
      setState('unsupported')
      setError(tr('Voice not supported here'))
      return
    }
    if (!isAsrModelDownloaded()) {
      setState('unsupported')
      setError(tr('Download the speech recognition model in Settings to use your voice.'))
      return
    }
    const sessionId = ++sessionIdRef.current
    setState('listening')
    setError(null)
    void (async () => {
      try {
        const recognizer = await StreamingRecognizer.create()
        if (sessionId !== sessionIdRef.current) return // stop() ran before the model finished loading
        recognizerRef.current = recognizer
        const capture = await startMicCapture((samples) => {
          void recognizer.pushAudio(samples).then((text) => onInterimRef.current?.(text))
        })
        if (sessionId !== sessionIdRef.current) {
          capture.stop()
          return
        }
        captureRef.current = capture
      } catch (err) {
        if (sessionId === sessionIdRef.current) {
          setState('unsupported')
          setError(err instanceof Error ? err.message : tr('Could not start voice recording.'))
        }
      }
    })()
  }, [])

  const stop = useCallback(() => {
    sessionIdRef.current++ // invalidates an in-flight start() from a rapid tap-stop-before-ready
    const capture = captureRef.current
    captureRef.current = null
    capture?.stop()
    setState('idle')
    const recognizer = recognizerRef.current
    recognizerRef.current = null
    if (recognizer) {
      void recognizer.finish().then((text) => {
        if (text) onResultRef.current(text)
      })
    }
  }, [])

  return { state, error, start, stop }
}
