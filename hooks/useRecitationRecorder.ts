'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface RecorderState {
  recording: boolean
  blob: Blob | null
  error: string | null
}

export function useRecitationRecorder() {
  const [state, setState] = useState<RecorderState>({ recording: false, blob: null, error: null })
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopTracks = useCallback(() => {
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const startRecording = useCallback(async () => {
    setState({ recording: false, blob: null, error: null })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setState({ recording: false, blob, error: null })
        stopTracks()
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setState({ recording: true, blob: null, error: null })
    } catch {
      setState({
        recording: false,
        blob: null,
        error: 'Microphone access is required to record your recitation.',
      })
    }
  }, [stopTracks])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
    }
  }, [])

  const clearRecording = useCallback(() => {
    setState({ recording: false, blob: null, error: null })
    chunksRef.current = []
  }, [])

  useEffect(() => {
    return () => stopTracks()
  }, [stopTracks])

  return { ...state, startRecording, stopRecording, clearRecording }
}
