'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square } from 'lucide-react'
import Button from '@/components/ui/Button'
import LiveWaveform from '@/components/test/LiveWaveform'
import type { AppError } from '@/lib/errors'

interface RecorderProps {
  onRecordingComplete: (blob: Blob) => void
  disabled?: boolean
  onActiveChange?: (active: boolean) => void
  onMicError?: (error: AppError) => void
}

export default function Recorder({
  onRecordingComplete,
  disabled,
  onActiveChange,
  onMicError,
}: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        onRecordingComplete(blob)
        setIsRecording(false)
        onActiveChange?.(false)
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      onActiveChange?.(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch {
      onMicError?.({
        kind: 'mic',
        title: 'Microphone access needed',
        message: 'Allow access in your browser settings, then tap Try again.',
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }

  if (isRecording) {
    return (
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-6 text-[13px] font-medium text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block motion-safe:animate-pulse" />
          Recording
          <span className="tabular-nums text-[12px] font-normal text-stone-400">
            {formatTime(recordingTime)}
          </span>
        </div>

        <div className="relative inline-flex mb-6 recording-pulse">
          <button
            type="button"
            onClick={stopRecording}
            className="relative z-10 w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Stop recording"
          >
            <Square className="w-6 h-6 fill-current" />
          </button>
        </div>

        <p className="text-[13px] text-stone-400 mb-4">Tap to stop when done</p>
        <LiveWaveform />
      </div>
    )
  }

  return (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      onClick={startRecording}
      disabled={disabled}
    >
      <Mic className="w-4 h-4" aria-hidden />
      Start recording
    </Button>
  )
}
