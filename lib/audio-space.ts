/**
 * The space a recitation sounds like it was recorded in.
 *
 * A phone microphone in a bedroom gives you a dry, close, slightly harsh
 * voice. None of that can be made into a studio master, but careful EQ, two
 * gentle stages of compression and a convincing, clean tail get it a long way
 * closer to how a published recitation is heard.
 */

export type SpaceId = 'clean' | 'reciter' | 'mosque'

export interface Space {
  id: SpaceId
  label: string
  hint: string
  /** Length of the tail in seconds, to silence. Zero means no reverb at all. */
  seconds: number
  /** One-pole coefficient, 0–1, at the start of the tail. Lower is darker. */
  brightness: number
  /** How much darker the tail gets by its end, 0–1 (stone swallows the top first). */
  damping: number
  /** Gap before the first reflection — what makes a space feel large. */
  preDelay: number
  /** Level of the first reflections off nearby walls, against the tail. */
  early: number
  /** How much tail is mixed under the voice. */
  wet: number
}

export const SPACES: Space[] = [
  {
    id: 'clean',
    label: 'Clean',
    hint: 'Close and dry',
    // A small, well-treated room: enough to take the edge off a dry phone
    // recording without sounding like any room at all.
    seconds: 0.8,
    brightness: 0.55,
    damping: 0.5,
    preDelay: 0.012,
    early: 0.5,
    wet: 0.12,
  },
  {
    id: 'reciter',
    label: 'Reciter',
    hint: 'Warm hall, voice forward',
    // The published-recitation sound: a long pre-delay keeps the voice up
    // front and every letter clear, while a smooth tail opens up behind it.
    seconds: 2.2,
    brightness: 0.48,
    damping: 0.6,
    preDelay: 0.06,
    early: 0.35,
    wet: 0.32,
  },
  {
    id: 'mosque',
    label: 'Mosque',
    hint: 'Big stone hall',
    seconds: 3.6,
    brightness: 0.42,
    damping: 0.7,
    preDelay: 0.045,
    early: 0.45,
    wet: 0.4,
  },
]

export function findSpace(id: SpaceId): Space {
  return SPACES.find((s) => s.id === id) ?? SPACES[1]
}

/** Repeatable noise, so a recitation's room is the same on every play and every share. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Build the room as a real one sounds: a handful of distinct early reflections
 * off the nearest walls, then a dense tail that falls away evenly to silence
 * and darkens as it goes. Left and right differ, so the room is wide while
 * the voice stays in the middle.
 */
export function createImpulseResponse(ctx: BaseAudioContext, space: Space): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.max(1, Math.floor(rate * space.seconds))
  const buffer = ctx.createBuffer(2, length, rate)
  const index = SPACES.findIndex((s) => s.id === space.id)

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    const random = seededRandom(0x51a7 + index * 97 + channel * 7919)

    // Late tail: -60dB by the end, fading in over the first 40ms so the
    // early reflections are heard first, as they are in a room.
    const fadeIn = Math.floor(rate * 0.04)
    let low = 0
    for (let i = 0; i < length; i += 1) {
      const t = i / length
      const envelope = Math.pow(10, -3 * t) * Math.min(1, i / fadeIn)
      const coefficient = space.brightness * (1 - space.damping * t)
      low += ((random() * 2 - 1) * envelope - low) * coefficient
      data[i] = low
    }

    // Early reflections: sparse taps over the first ~80ms, quieter as they go.
    const taps = 9
    for (let n = 0; n < taps; n += 1) {
      const at = Math.floor(rate * (0.006 + (0.075 * (n + random())) / taps))
      if (at >= length) break
      const level = space.early * (1 - n / (taps + 2)) * (0.55 + 0.45 * random())
      data[at] += (random() < 0.5 ? -1 : 1) * level
    }
  }

  return buffer
}

/**
 * Measured with a voice-like test signal over a -66dB room: a 30dB spread
 * between a soft and a raised phrase leaves as about 15dB, soft recitation is
 * lifted by 13dB, peaks stay under -2dB, and the room's hiss ends up 7dB
 * quieter than the microphone gave it. Pushing the compressors harder evens
 * the voice more but lifts the hiss faster than the expander can hold it.
 */
const MAKEUP_GAIN = 1.5

/**
 * The downward expander from public/audio/qari-expander.js, or null where
 * audio worklets are missing — the recording then simply keeps its room noise.
 */
async function createExpander(ctx: BaseAudioContext): Promise<AudioNode | null> {
  try {
    if (!ctx.audioWorklet) return null
    await ctx.audioWorklet.addModule('/audio/qari-expander.js')
    return new AudioWorkletNode(ctx, 'qari-expander')
  } catch {
    return null
  }
}

/**
 * The shaping half of the chain: everything that makes a phone capsule sound
 * like a recorded voice, and nothing that depends on which space was chosen.
 *
 * This is what gets baked into the recording. The tail is deliberately left
 * out so the space can still be changed after the take — see createSpaceMixer.
 */
export async function buildVoiceShaping(ctx: BaseAudioContext, source: AudioNode): Promise<AudioNode> {
  // Rumble, handling noise and breath pops all live below here.
  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 75
  highpass.Q.value = 0.7

  // Quiets the room between ayat before anything lifts it (see the worklet).
  const expander = await createExpander(ctx)

  // Body. A phone capsule held at arm's length has none of the weight a
  // close large-diaphragm mic gives a voice; this puts some back.
  const body = ctx.createBiquadFilter()
  body.type = 'lowshelf'
  body.frequency.value = 180
  body.gain.value = 2.5

  // The boxiness of an untreated room sits right about here.
  const mud = ctx.createBiquadFilter()
  mud.type = 'peaking'
  mud.frequency.value = 400
  mud.Q.value = 1.1
  mud.gain.value = -3

  // The nasal, phone-speaker honk.
  const honk = ctx.createBiquadFilter()
  honk.type = 'peaking'
  honk.frequency.value = 1000
  honk.Q.value = 1.4
  honk.gain.value = -1.5

  // Diction — the letters that stay legible under a tail.
  const presence = ctx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3800
  presence.Q.value = 0.9
  presence.gain.value = 2.5

  // Static de-ess, so the air below does not sharpen every س and ص.
  const sibilance = ctx.createBiquadFilter()
  sibilance.type = 'peaking'
  sibilance.frequency.value = 7200
  sibilance.Q.value = 1.6
  sibilance.gain.value = -3

  // Air. Most of what reads as "expensively recorded" is up here.
  const air = ctx.createBiquadFilter()
  air.type = 'highshelf'
  air.frequency.value = 10000
  air.gain.value = 2

  // Two gentle stages instead of one hard one: a slow leveller rides the
  // distance between a soft phrase and a raised one, then a faster stage
  // catches the peaks. Neither works hard, so nothing pumps or sounds squashed,
  // and the consonant at the start of each word keeps its shape.
  const leveller = ctx.createDynamicsCompressor()
  leveller.threshold.value = -42
  leveller.knee.value = 20
  leveller.ratio.value = 2.5
  leveller.attack.value = 0.025
  leveller.release.value = 0.4

  const catcher = ctx.createDynamicsCompressor()
  catcher.threshold.value = -24
  catcher.knee.value = 8
  catcher.ratio.value = 3
  catcher.attack.value = 0.004
  catcher.release.value = 0.12

  const makeup = ctx.createGain()
  makeup.gain.value = MAKEUP_GAIN

  // Nothing reaches the encoder hot enough to clip.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -6
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.08

  source.connect(highpass)
  if (expander) {
    highpass.connect(expander)
    expander.connect(body)
  } else {
    highpass.connect(body)
  }
  body.connect(mud)
  mud.connect(honk)
  honk.connect(presence)
  presence.connect(sibilance)
  sibilance.connect(air)
  air.connect(leveller)
  leveller.connect(catcher)
  catcher.connect(makeup)
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
 * Only the middle of the voice feeds the room: the low end would turn the
 * tail to mud and the hiss of every س would ring on after it. That is what
 * keeps a long hall sounding clean rather than washed out.
 *
 * The convolver's buffer, pre-delay and wet level are all parameters rather
 * than wiring, so choosing a different space is a handful of assignments —
 * which is what lets the room be changed on a take that already exists, and
 * even while it is playing.
 */
export function createSpaceMixer(ctx: BaseAudioContext, source: AudioNode): SpaceMixer {
  const dry = ctx.createGain()
  dry.gain.value = 1

  const sendLow = ctx.createBiquadFilter()
  sendLow.type = 'highpass'
  sendLow.frequency.value = 250
  sendLow.Q.value = 0.6

  const sendHigh = ctx.createBiquadFilter()
  sendHigh.type = 'lowpass'
  sendHigh.frequency.value = 6500
  sendHigh.Q.value = 0.6

  const preDelay = ctx.createDelay(1)
  const convolver = ctx.createConvolver()
  convolver.normalize = true

  const wet = ctx.createGain()
  wet.gain.value = 0

  // Voice and room together can peak higher than either; this keeps the sum clean.
  const ceiling = ctx.createDynamicsCompressor()
  ceiling.threshold.value = -2
  ceiling.knee.value = 0
  ceiling.ratio.value = 20
  ceiling.attack.value = 0.001
  ceiling.release.value = 0.1

  source.connect(dry).connect(ceiling)
  source.connect(sendLow)
  sendLow.connect(sendHigh)
  sendHigh.connect(preDelay)
  preDelay.connect(convolver)
  convolver.connect(wet).connect(ceiling)

  // Rebuilding an impulse response is not free, so each one is kept.
  const impulses = new Map<SpaceId, AudioBuffer>()

  return {
    output: ceiling,
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
