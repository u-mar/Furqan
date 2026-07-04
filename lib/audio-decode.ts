export type AudioInput = Blob | ArrayBuffer | AudioBuffer

export async function decodeToAudioBuffer(source: AudioInput): Promise<AudioBuffer> {
  if (typeof AudioBuffer !== 'undefined' && source instanceof AudioBuffer) {
    return source
  }

  const arrayBuffer: ArrayBuffer =
    source instanceof Blob ? await source.arrayBuffer() : (source as ArrayBuffer)
  if (arrayBuffer.byteLength < 44) {
    throw new Error('Audio data is empty')
  }

  const ctx = new AudioContext()
  try {
    if (ctx.state === 'suspended') await ctx.resume()
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await ctx.close()
  }
}

export async function resumeAudioContext(): Promise<AudioContext> {
  const ctx = new AudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  return ctx
}
