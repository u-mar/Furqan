/** The number of bars stored for every recitation's waveform. */
export const PEAK_COUNT = 48

/**
 * Measure how loud a recording is across its length, as whole numbers 0–100.
 *
 * Done on the phone at publish time and stored with the recitation, so every
 * row can draw its real shape without downloading the audio.
 */
export async function measurePeaks(blob: Blob, bars = PEAK_COUNT): Promise<number[]> {
  const decoder = new OfflineAudioContext(1, 1, 44100)
  const buffer = await decoder.decodeAudioData(await blob.arrayBuffer())
  const data = buffer.getChannelData(0)
  const bucket = Math.max(1, Math.floor(data.length / bars))

  const levels: number[] = []
  for (let b = 0; b < bars; b += 1) {
    const start = b * bucket
    const end = Math.min(data.length, start + bucket)
    let sum = 0
    let n = 0
    for (let i = start; i < end; i += 8) {
      sum += data[i] * data[i]
      n += 1
    }
    levels.push(n > 0 ? Math.sqrt(sum / n) : 0)
  }

  const loudest = Math.max(...levels, 0)
  // The square root lifts quiet phrases so a soft recitation still has a shape.
  return levels.map((level) => Math.round(100 * Math.sqrt(loudest > 0 ? level / loudest : 0)))
}
