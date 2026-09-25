'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Speaking an ayah instead of typing it, via the browser's own speech
 * recognition — no model to download, no server. This is a placeholder for
 * testing the feature end to end: it isn't tuned for Quranic recitation, so
 * expect rougher accuracy than a proper model, and Safari/iOS support is
 * inconsistent. Swapping in a real ASR model later only means changing what
 * calls `onResult`/`onInterim` here — everything downstream (the ayah search,
 * the live word-by-word reveal) is already decoupled from where the text
 * comes from.
 */

interface SpeechRecognitionResultAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionResultAlternativeLike> {
  isFinal: boolean
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type VoiceInputState = 'idle' | 'listening' | 'unsupported'

/**
 * `onResult` fires once, when the reciter stops (final transcript).
 * `onInterim`, if given, fires repeatedly while listening with the
 * best-guess transcript so far — recognition runs `continuous` so it keeps
 * listening across natural pauses between words instead of stopping after
 * the first one, matching the tap-to-start/tap-to-stop mic control.
 */
export function useArabicVoiceInput(onResult: (text: string) => void, onInterim?: (text: string) => void) {
  const [state, setState] = useState<VoiceInputState>('idle')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onInterimRef = useRef(onInterim)
  onInterimRef.current = onInterim

  useEffect(() => {
    if (!getSpeechRecognitionCtor()) setState('unsupported')
  }, [])

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setState('unsupported')
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'ar-SA'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1
    let finalTranscript = ''
    let lastCombined = ''
    recognition.onresult = (event) => {
      let finalSoFar = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalSoFar += `${text} `
        else interim += text
      }
      finalTranscript = finalSoFar
      lastCombined = `${finalSoFar} ${interim}`.trim()
      onInterimRef.current?.(lastCombined)
    }
    recognition.onerror = () => setState('idle')
    recognition.onend = () => {
      setState('idle')
      // `stop()` should flush a final result for whatever was heard, but if
      // the browser ends before that lands, fall back to the last interim
      // guess rather than losing the recitation entirely.
      const text = finalTranscript.trim() || lastCombined
      if (text) onResultRef.current(text)
    }
    recognitionRef.current = recognition
    setState('listening')
    recognition.start()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { state, start, stop }
}
