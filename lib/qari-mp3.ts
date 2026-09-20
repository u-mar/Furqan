/**
 * MP3 encoding on the device, for recitations that are shared and for the ones
 * just recorded. MP3 is the one format every phone, browser and messaging app
 * plays; the recorder's own WebM/Opus does not play on older iPhones.
 */

let mp3EncoderReady: Promise<void> | null = null

/** Browsers almost never encode MP3 natively; a small bundled encoder covers them. */
export function ensureMp3Encoder(): Promise<void> {
  if (!mp3EncoderReady) {
    mp3EncoderReady = (async () => {
      const { canEncodeAudio } = await import('mediabunny')
      if (await canEncodeAudio('mp3')) return
      const { registerMp3Encoder } = await import('@mediabunny/mp3-encoder')
      registerMp3Encoder()
    })()
  }
  return mp3EncoderReady
}

export function sliceBuffer(buffer: AudioBuffer, start: number, end: number): AudioBuffer {
  const out = new AudioBuffer({
    length: end - start,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  })
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    out.copyToChannel(buffer.getChannelData(channel).subarray(start, end), channel)
  }
  return out
}

export interface EncodedRecording {
  blob: Blob
  mimeType: 'audio/mp4' | 'audio/mpeg'
}

/**
 * The finished recitation as a file. AAC in an MP4 container is encoded by the
 * phone's own hardware, several times faster than MP3 in software, and plays
 * everywhere; MP3 is the fallback for browsers that cannot encode it.
 */
export async function encodeRecording(
  buffer: AudioBuffer,
  quality: 'medium' | 'low' = 'medium',
  onProgress?: (fraction: number) => void
): Promise<EncodedRecording> {
  try {
    const mb = await import('mediabunny')
    if (await mb.canEncodeAudio('aac')) {
      const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() })
      const source = new mb.AudioBufferSource({
        codec: 'aac',
        bitrate: quality === 'low' ? 64_000 : 96_000,
      })
      output.addAudioTrack(source)
      await output.start()
      const chunk = buffer.sampleRate * 2
      for (let start = 0; start < buffer.length; start += chunk) {
        const end = Math.min(buffer.length, start + chunk)
        await source.add(sliceBuffer(buffer, start, end))
        onProgress?.(end / buffer.length)
      }
      await output.finalize()
      const data = output.target.buffer
      if (data) return { blob: new Blob([data], { type: 'audio/mp4' }), mimeType: 'audio/mp4' }
    }
  } catch {
    // Fall through to MP3.
  }
  const blob = await encodeMp3(buffer, { quality, onProgress })
  return { blob, mimeType: 'audio/mpeg' }
}

export interface Mp3Options {
  /** Medium is well past transparent for a voice; low is for very long takes. */
  quality?: 'medium' | 'low'
  /** 0–1. */
  onProgress?: (fraction: number) => void
  /** Called between chunks; return true to stop and throw. */
  isCancelled?: () => boolean
  onCancel?: () => Error
}

export async function encodeMp3(buffer: AudioBuffer, options: Mp3Options = {}): Promise<Blob> {
  const { quality = 'medium', onProgress, isCancelled, onCancel } = options
  const mb = await import('mediabunny')
  await ensureMp3Encoder()

  const output = new mb.Output({ format: new mb.Mp3OutputFormat(), target: new mb.BufferTarget() })
  const source = new mb.AudioBufferSource({
    codec: 'mp3',
    quality: quality === 'low' ? mb.QUALITY_LOW : mb.QUALITY_MEDIUM,
  })
  output.addAudioTrack(source)
  await output.start()

  const chunk = buffer.sampleRate * 2
  for (let start = 0; start < buffer.length; start += chunk) {
    if (isCancelled?.()) {
      await output.cancel()
      throw onCancel?.() ?? new Error('Cancelled')
    }
    const end = Math.min(buffer.length, start + chunk)
    await source.add(sliceBuffer(buffer, start, end))
    onProgress?.(end / buffer.length)
  }

  await output.finalize()
  const data = output.target.buffer
  if (!data) throw new Error('Could not encode the audio.')
  return new Blob([data], { type: 'audio/mpeg' })
}
