'use client'

import { encodeRecording, sliceBuffer } from '@/lib/qari-mp3'

/** The shortest a recitation may be cut down to, in seconds. */
export const MIN_TRIM_SECONDS = 2

/**
 * A recording with its start and end cut off: decoded, the part between `from` and `to`
 * (seconds) kept, and made into a file again the way a fresh take is. The new ends are faded
 * over a few milliseconds, so a cut in the middle of a sound does not click.
 */
export async function trimRecording(
  blob: Blob,
  from: number,
  to: number,
  onProgress?: (fraction: number) => void
): Promise<{ blob: Blob; mimeType: string; durationSec: number }> {
  const decoder = new OfflineAudioContext(1, 1, 44100)
  const buffer = await decoder.decodeAudioData(await blob.arrayBuffer())
  const start = Math.max(0, Math.floor(from * buffer.sampleRate))
  const end = Math.min(buffer.length, Math.ceil(to * buffer.sampleRate))
  if (end - start < MIN_TRIM_SECONDS * buffer.sampleRate) throw new Error('too short')
  const kept = sliceBuffer(buffer, start, end)
  const fade = Math.min(Math.floor(buffer.sampleRate * 0.012), Math.floor(kept.length / 4))
  for (let channel = 0; channel < kept.numberOfChannels; channel += 1) {
    const data = kept.getChannelData(channel)
    for (let i = 0; i < fade; i += 1) {
      const gain = i / fade
      if (start > 0) data[i] *= gain
      if (end < buffer.length) data[data.length - 1 - i] *= gain
    }
  }
  const encoded = await encodeRecording(kept, 'medium', onProgress)
  return { blob: encoded.blob, mimeType: encoded.mimeType, durationSec: kept.length / kept.sampleRate }
}

/**
 * A recording with a piece taken out of its middle: what comes before `from` and what comes
 * after `to` (seconds), joined. Each side of the join is faded over a few milliseconds, so the
 * place where a cough or a mistake was does not click.
 */
export async function cutOutOfRecording(
  blob: Blob,
  from: number,
  to: number,
  onProgress?: (fraction: number) => void
): Promise<{ blob: Blob; mimeType: string; durationSec: number }> {
  const decoder = new OfflineAudioContext(1, 1, 44100)
  const buffer = await decoder.decodeAudioData(await blob.arrayBuffer())
  const a = Math.max(0, Math.min(buffer.length, Math.floor(from * buffer.sampleRate)))
  const b = Math.max(a, Math.min(buffer.length, Math.ceil(to * buffer.sampleRate)))
  const length = a + (buffer.length - b)
  if (length < MIN_TRIM_SECONDS * buffer.sampleRate) throw new Error('too short')
  const joined = new AudioBuffer({ length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate })
  const fade = Math.min(Math.floor(buffer.sampleRate * 0.012), Math.floor(a / 2), Math.floor((buffer.length - b) / 2))
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const source = buffer.getChannelData(channel)
    const data = joined.getChannelData(channel)
    data.set(source.subarray(0, a), 0)
    data.set(source.subarray(b), a)
    for (let i = 0; i < fade; i += 1) {
      const gain = i / fade
      data[a - 1 - i] *= gain
      data[a + i] *= gain
    }
  }
  const encoded = await encodeRecording(joined, 'medium', onProgress)
  return { blob: encoded.blob, mimeType: encoded.mimeType, durationSec: joined.length / joined.sampleRate }
}
