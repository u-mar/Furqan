/**
 * Captures raw mono 16kHz mic PCM via an AudioWorklet and hands it to
 * `onChunk` as it arrives (~every 8ms, one audio render quantum) — the
 * source `StreamingRecognizer.pushAudio` is built to consume. Creating the
 * AudioContext with `sampleRate: 16000` makes the browser resample the raw
 * mic input to match automatically; nothing downstream needs to resample.
 */

const WORKLET_SOURCE = `
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0]
    if (channel && channel.length > 0) {
      const copy = channel.slice(0)
      this.port.postMessage(copy.buffer, [copy.buffer])
    }
    return true
  }
}
registerProcessor('pcm-capture-processor', PcmCaptureProcessor)
`

export interface MicCapture {
  stop: () => void
}

export function isMicCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof AudioWorkletNode !== 'undefined'
  )
}

/** Throws if the mic is unavailable or permission is denied — callers
 *  should catch and fall back to an 'unsupported'/'idle' state. */
export async function startMicCapture(onChunk: (samples: Float32Array) => void): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  })
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const blobUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }))
  try {
    await audioContext.audioWorklet.addModule(blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }

  const source = audioContext.createMediaStreamSource(stream)
  const worklet = new AudioWorkletNode(audioContext, 'pcm-capture-processor')
  worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onChunk(new Float32Array(event.data))
  source.connect(worklet)

  return {
    stop: () => {
      worklet.port.onmessage = null
      source.disconnect()
      worklet.disconnect()
      stream.getTracks().forEach((track) => track.stop())
      void audioContext.close()
    },
  }
}
