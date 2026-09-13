/**
 * The space a recitation sounds like it was recorded in.
 *
 * A phone microphone in a bedroom gives you a dry, close, slightly harsh
 * voice. None of that can be made into a studio master, but a high-pass, a
 * gentle compressor and a convincing tail get it a long way closer to how a
 * recitation is normally heard.
 */

export type SpaceId = 'dry' | 'room' | 'mosque'

export interface Space {
  id: SpaceId
  label: string
  hint: string
  /** Length of the tail in seconds. Zero means no reverb at all. */
  seconds: number
  /** Higher numbers fade the tail away faster. */
  decay: number
  /** One-pole coefficient, 0–1. Lower swallows more of the top end. */
  brightness: number
  /** Gap before the first reflection — what makes a space feel large. */
  preDelay: number
  /** How much tail is mixed under the voice. */
  wet: number
}

export const SPACES: Space[] = [
  {
    id: 'dry',
    label: 'Dry',
    hint: 'Your voice, cleaned up',
    seconds: 0,
    decay: 0,
    brightness: 0,
    preDelay: 0,
    wet: 0,
  },
  {
    id: 'room',
    label: 'Room',
    hint: 'A little air around it',
    seconds: 1.6,
    decay: 1.9,
    brightness: 0.55,
    preDelay: 0.016,
    wet: 0.24,
  },
  {
    id: 'mosque',
    label: 'Mosque',
    hint: 'Wide, stone, echoing',
    // Tuned by rendering a click through the chain: this lands at roughly
    // two seconds of audible tail, which is what a prayer hall actually has.
    // Longer swallows the words.
    seconds: 3.8,
    decay: 1.2,
    brightness: 0.45,
    preDelay: 0.048,
    wet: 0.4,
  },
]

export function findSpace(id: SpaceId): Space {
  return SPACES.find((s) => s.id === id) ?? SPACES[0]
}

/**
 * Build the tail as noise under a decaying envelope — the shape any room's
 * reverb actually has — darkening as it runs on, the way stone absorbs the
 * top end long before the bottom.
 */
export function createImpulseResponse(ctx: BaseAudioContext, space: Space): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.max(1, Math.floor(rate * space.seconds))
  const buffer = ctx.createBuffer(2, length, rate)

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    let low = 0
    for (let i = 0; i < length; i += 1) {
      const t = i / length
      const noise = (Math.random() * 2 - 1) * Math.pow(1 - t, space.decay)
      low += (noise - low) * space.brightness
      data[i] = low
    }
  }

  return buffer
}

/**
 * Source → cleaned, evened-out voice → optional tail.
 *
 * Returns the node to record from. The browser's own echo cancellation,
 * noise suppression and gain control are left switched off by the caller:
 * they are tuned for phone calls and make a recitation sound thin and pumped.
 */
export function buildVoiceChain(ctx: AudioContext, source: AudioNode, space: Space): AudioNode {
  // Rumble, handling noise and breath pops all live below here.
  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 80
  highpass.Q.value = 0.7

  // A small lift where consonants sit, so words stay legible under a tail.
  const presence = ctx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3200
  presence.Q.value = 0.9
  presence.gain.value = 2.5

  // Narrows the gap between a quiet phrase and a raised one.
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -26
  compressor.knee.value = 24
  compressor.ratio.value = 3
  compressor.attack.value = 0.006
  compressor.release.value = 0.25

  source.connect(highpass)
  highpass.connect(presence)
  presence.connect(compressor)

  const out = ctx.createGain()

  if (space.seconds <= 0 || space.wet <= 0) {
    compressor.connect(out)
    return out
  }

  // Keep the dry voice forward; the tail sits underneath it.
  const dry = ctx.createGain()
  dry.gain.value = 1 - space.wet * 0.35
  const wet = ctx.createGain()
  wet.gain.value = space.wet

  const preDelay = ctx.createDelay(1)
  preDelay.delayTime.value = space.preDelay

  const convolver = ctx.createConvolver()
  convolver.normalize = true
  convolver.buffer = createImpulseResponse(ctx, space)

  compressor.connect(dry).connect(out)
  compressor.connect(preDelay)
  preDelay.connect(convolver)
  convolver.connect(wet).connect(out)

  return out
}
