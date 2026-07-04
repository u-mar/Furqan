'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface RecorderState {
  recording: boolean
  blob: Blob | null
  audioBuffer: AudioBuffer | null
  error: string | null
}

function mergePcmChunks(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((sum, c) => sum + c.length, 0)
  const merged = new Float32Array(length)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

function pcmToAudioBuffer(ctx: AudioContext, samples: Float32Array): AudioBuffer {
  const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
  buffer.copyToChannel(new Float32Array(samples), 0)
  return buffer
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channel = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const pcm = new Int16Array(channel.length)
  for (let i = 0; i < channel.length; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + pcm.byteLength, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, pcm.byteLength, true)

  return new Blob([header, pcm], { type: 'audio/wav' })
}

export interface RecordingResult {
  blob: Blob | null
  audioBuffer: AudioBuffer | null
}

export function useRecitationRecorder() {
  const [state, setState] = useState<RecorderState>({
    recording: false,
    blob: null,
    audioBuffer: null,
    error: null,
  })

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()
    processorRef.current = null
    sourceRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioContextRef.current?.close()
    audioContextRef.current = null
    pcmChunksRef.current = []
  }, [])

  const startRecording = useCallback(async () => {
    cleanup()
    setState({ recording: false, blob: null, audioBuffer: null, error: null })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const ctx = new AudioContext()
      audioContextRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      pcmChunksRef.current = []

      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0)
        pcmChunksRef.current.push(new Float32Array(input))
      }

      source.connect(processor)
      const silent = ctx.createGain()
      silent.gain.value = 0
      processor.connect(silent)
      silent.connect(ctx.destination)

      sourceRef.current = source
      processorRef.current = processor

      setState({ recording: true, blob: null, audioBuffer: null, error: null })
    } catch {
      cleanup()
      setState({
        recording: false,
        blob: null,
        audioBuffer: null,
        error: 'Microphone access is required to record your recitation.',
      })
    }
  }, [cleanup])

  const stopRecording = useCallback((): Promise<RecordingResult> => {
    return new Promise((resolve) => {
      const ctx = audioContextRef.current
      if (!ctx || !processorRef.current) {
        cleanup()
        resolve({ blob: null, audioBuffer: null })
        return
      }

      processorRef.current.onaudioprocess = null
      const samples = mergePcmChunks(pcmChunksRef.current)
      pcmChunksRef.current = []

      processorRef.current.disconnect()
      sourceRef.current?.disconnect()
      processorRef.current = null
      sourceRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null

      if (samples.length < ctx.sampleRate * 0.25) {
        void ctx.close()
        audioContextRef.current = null
        setState({ recording: false, blob: null, audioBuffer: null, error: null })
        resolve({ blob: null, audioBuffer: null })
        return
      }

      const audioBuffer = pcmToAudioBuffer(ctx, samples)
      const blob = audioBufferToWav(audioBuffer)
      void ctx.close()
      audioContextRef.current = null

      setState({ recording: false, blob, audioBuffer, error: null })
      resolve({ blob, audioBuffer })
    })
  }, [cleanup])

  const clearRecording = useCallback(() => {
    cleanup()
    setState({ recording: false, blob: null, audioBuffer: null, error: null })
  }, [cleanup])

  useEffect(() => () => cleanup(), [cleanup])

  return { ...state, startRecording, stopRecording, clearRecording }
}
