'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Speaking an ayah instead of typing it, via the browser's own speech
 * recognition — no model to download, no server. This is a placeholder for
 * testing the feature end to end: it isn't tuned for Quranic recitation, so
 * expect rougher accuracy than a proper model, and Safari/iOS support is
 * inconsistent. Swapping in a real ASR model later only means changing what
 * calls `onResult` here — everything downstream (the ayah search) is
 * already decoupled from where the text comes from.
 */

interface SpeechRecognitionResultLike {
  transcript: string
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  interimResults: boolean
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

export function useArabicVoiceInput(onResult: (text: string) => void) {
  const [state, setState] = useState<VoiceInputState>('idle')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

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
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim()
      if (text) onResultRef.current(text)
    }
    recognition.onerror = () => setState('idle')
    recognition.onend = () => setState('idle')
    recognitionRef.current = recognition
    setState('listening')
    recognition.start()
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  return { state, start, stop }
}
