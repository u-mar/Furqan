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
  const mimeTypeRef = useRef('audio/webm')

  const stopTracks = useCallback(() => {
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
  }, [])

  const startRecording = useCallback(async () => {
    setState({ recording: false, blob: null, error: null })
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : ''
      if (!mimeType) {
        setState({
          recording: false,
          blob: null,
          error: 'Recording is not supported in this browser.',
        })
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      mimeTypeRef.current = mimeType
      const recorder = new MediaRecorder(stream, { mimeType })
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = recorder
      recorder.start(250)
      setState({ recording: true, blob: null, error: null })
    } catch {
      setState({
        recording: false,
        blob: null,
        error: 'Microphone access is required to record your recitation.',
      })
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state !== 'recording') {
        resolve(null)
        return
      }
      const mimeType = mimeTypeRef.current
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        stopTracks()
        mediaRecorderRef.current = null
        const valid = blob.size > 0 ? blob : null
        setState({ recording: false, blob: valid, error: null })
        resolve(valid)
      }
      try {
        recorder.requestData()
      } catch {
        // some browsers omit requestData
      }
      recorder.stop()
    })
  }, [stopTracks])

  const clearRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    stopTracks()
    mediaRecorderRef.current = null
    chunksRef.current = []
    setState({ recording: false, blob: null, error: null })
  }, [stopTracks])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      stopTracks()
    }
  }, [stopTracks])

  return { ...state, startRecording, stopRecording, clearRecording }
}
