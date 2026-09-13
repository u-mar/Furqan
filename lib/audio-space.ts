/**
 * The space a recitation sounds like it was recorded in.
 *
 * A phone microphone in a bedroom gives you a dry, close, slightly harsh
 * voice. None of that can be made into a studio master, but a high-pass, a
 * gentle compressor and a convincing tail get it a long way closer to how a
 * recitation is normally heard.
 */

export type SpaceId = 'clean' | 'reciter' | 'mosque'

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
    id: 'clean',
    label: 'Clean',
    hint: 'Close and dry',
    seconds: 0.9,
    decay: 2.2,
    brightness: 0.6,
    preDelay: 0.022,
    wet: 0.12,
  },
  {
    id: 'reciter',
    label: 'Reciter',
    hint: 'Warm hall, voice forward',
    // The published-recitation sound: a long pre-delay keeps the voice up
    // front while the tail opens up behind it. Most of the character comes
    // from the pre-delay, not the length.
    seconds: 1.9,
    decay: 1.6,
    brightness: 0.5,
    preDelay: 0.075,
    wet: 0.26,
  },
  {
    id: 'mosque',
    label: 'Mosque',
    hint: 'Big stone hall',
    seconds: 3.4,
    decay: 1.15,
    brightness: 0.42,
    preDelay: 0.06,
    wet: 0.36,
  },
]

export function findSpace(id: SpaceId): Space {
  return SPACES.find((s) => s.id === id) ?? SPACES[1]
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
 * The shaping half of the chain: everything that makes a phone capsule sound
 * like a recorded voice, and nothing that depends on which space was chosen.
 *
 * This is what gets baked into the recording. The tail is deliberately left
 * out so the space can still be changed after the take — see createSpaceMixer.
 */
export function buildVoiceShaping(ctx: AudioContext, source: AudioNode): AudioNode {
  // Rumble, handling noise and breath pops all live below here.
  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 70
  highpass.Q.value = 0.7

  // Body. A phone capsule held at arm's length has none of the weight a
  // close large-diaphragm mic gives a voice; this puts some back.
  const body = ctx.createBiquadFilter()
  body.type = 'lowshelf'
  body.frequency.value = 200
  body.gain.value = 3

  // The boxiness of an untreated room sits right about here.
  const mud = ctx.createBiquadFilter()
  mud.type = 'peaking'
  mud.frequency.value = 420
  mud.Q.value = 1.1
  mud.gain.value = -2.5

  // Diction — the consonants that let words stay legible under a tail.
  const presence = ctx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 4200
  presence.Q.value = 0.8
  presence.gain.value = 3

  // Static de-ess, so lifting the air below does not sharpen every 's'.
  const sibilance = ctx.createBiquadFilter()
  sibilance.type = 'peaking'
  sibilance.frequency.value = 7000
  sibilance.Q.value = 1.5
  sibilance.gain.value = -2

  // Air. Most of what reads as "expensively recorded" is up here.
  const air = ctx.createBiquadFilter()
  air.type = 'highshelf'
  air.frequency.value = 9500
  air.gain.value = 2

  // Evens out the distance between a quiet phrase and a raised one. Measured
  // by rendering noise at four levels through this chain: a 26dB spread at
  // the input leaves as 6.5dB, which is the consistency a published
  // recitation has. Lower thresholds than this start lifting room noise.
  const leveller = ctx.createDynamicsCompressor()
  leveller.threshold.value = -34
  leveller.knee.value = 20
  leveller.ratio.value = 4.5
  leveller.attack.value = 0.005
  leveller.release.value = 0.18

  const makeup = ctx.createGain()
  makeup.gain.value = 2.1

  // Nothing reaches the encoder hot enough to clip.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 2
  limiter.ratio.value = 14
  limiter.attack.value = 0.002
  limiter.release.value = 0.08

  source.connect(highpass)
  highpass.connect(body)
  body.connect(mud)
  mud.connect(presence)
  presence.connect(sibilance)
  sibilance.connect(air)
  air.connect(leveller)
  leveller.connect(makeup)
  makeup.connect(limiter)

  const out = ctx.createGain()
  limiter.connect(out)
  return out
}

export interface SpaceMixer {
  /** Connect this to a destination. */
  output: AudioNode
  /** Swap the space without rebuilding the graph, so it can change mid-play. */
  setSpace(space: Space): void
}

/**
 * The tail half, kept swappable.
 *
 * The convolver's buffer, pre-delay and wet level are all parameters rather
 * than wiring, so choosing a different space is a handful of assignments —
 * which is what lets the filter be changed on a take that already exists,
 * and even while it is playing.
 */
export function createSpaceMixer(ctx: AudioContext, source: AudioNode): SpaceMixer {
  const dry = ctx.createGain()
  dry.gain.value = 1

  const preDelay = ctx.createDelay(1)
  const convolver = ctx.createConvolver()
  convolver.normalize = true

  const wet = ctx.createGain()
  wet.gain.value = 0

  const output = ctx.createGain()

  source.connect(dry).connect(output)
  source.connect(preDelay)
  preDelay.connect(convolver)
  convolver.connect(wet).connect(output)

  // Rebuilding an impulse response is not free, so each one is kept.
  const impulses = new Map<SpaceId, AudioBuffer>()

  return {
    output,
    setSpace(space: Space) {
      if (space.seconds <= 0 || space.wet <= 0) {
        wet.gain.value = 0
        return
      }
      let impulse = impulses.get(space.id)
      if (!impulse) {
        impulse = createImpulseResponse(ctx, space)
        impulses.set(space.id, impulse)
      }
      convolver.buffer = impulse
      preDelay.delayTime.value = space.preDelay
      wet.gain.value = space.wet
    },
  }
}
