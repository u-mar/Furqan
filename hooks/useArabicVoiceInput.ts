'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PluginListenerHandle } from '@capacitor/core'
import { hasNativePlugin, nativePlugin } from '@/lib/native-app'

/**
 * Speaking an ayah instead of typing it, via the browser's own speech
 * recognition — no model to download, no server. This is a placeholder for
 * testing the feature end to end: it isn't tuned for Quranic recitation, so
 * expect rougher accuracy than a proper model, and Safari/iOS support is
 * inconsistent. Swapping in a real ASR model later only means changing what
 * calls `onResult`/`onInterim` here — everything downstream (the ayah search,
 * the live word-by-word reveal) is already decoupled from where the text
 * comes from.
 *
 * In the Play Store app, whose WebView has no speech recognition, the phone's
 * own is used instead (android/…/NabaSpeechPlugin.java).
 */

interface NabaSpeech {
  start: (options: { lang: string }) => Promise<void>
  stop: () => Promise<void>
  /** "partial": the words so far, while speaking; "end": everything heard, once done. */
  addListener: (event: 'partial' | 'end', listener: (data: { text: string }) => void) => Promise<PluginListenerHandle>
}

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
  const nativeStopRef = useRef<(() => void) | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onInterimRef = useRef(onInterim)
  onInterimRef.current = onInterim

  useEffect(() => {
    if (!hasNativePlugin('NabaSpeech') && !getSpeechRecognitionCtor()) setState('unsupported')
  }, [])

  useEffect(
    () => () => {
      recognitionRef.current?.stop()
      nativeStopRef.current?.()
    },
    [],
  )

  const startNative = useCallback(async () => {
    setState('listening')
    const { plugin: speech } = await nativePlugin<NabaSpeech>('NabaSpeech')
    const handles: PluginListenerHandle[] = []
    const done = () => {
      handles.forEach((handle) => void handle.remove())
      nativeStopRef.current = null
      setState('idle')
    }
    handles.push(await speech.addListener('partial', ({ text }) => onInterimRef.current?.(text)))
    handles.push(
      await speech.addListener('end', ({ text }) => {
        done()
        if (text) onResultRef.current(text)
      }),
    )
    nativeStopRef.current = () => void speech.stop()
    try {
      await speech.start({ lang: 'ar-SA' })
    } catch (error) {
      done()
      // A phone without any speech recognition: hide the mic, as on the web.
      if ((error as { code?: string })?.code === 'unavailable') setState('unsupported')
    }
  }, [])

  const start = useCallback(() => {
    if (hasNativePlugin('NabaSpeech')) {
      void startNative()
      return
    }
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
  }, [startNative])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    nativeStopRef.current?.()
  }, [])

  return { state, start, stop }
}
