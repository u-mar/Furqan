import { PitchDetector } from 'pitchy'
import { clampScore, cosineSimilarity, dtwAlign, pearsonCorrelation } from '@/lib/dtw'
import { decodeToAudioBuffer, type AudioInput } from '@/lib/audio-decode'

export type { AudioInput } from '@/lib/audio-decode'

export interface AudioFrame {
  rms: number
  pitch: number | null
  spectrum: number[]
}

export interface VoiceDiffRegion {
  startMs: number
  endMs: number
  layer: 'tone' | 'sound' | 'flow'
  severity: number
  tip: string
}

export interface VoiceSimilarityResult {
  voiceSimilarity: number
  tone: number
  sound: number
  flow: number
  refWaveform: number[]
  userWaveform: number[]
  refPitch: (number | null)[]
  userPitch: (number | null)[]
  diffRegions: VoiceDiffRegion[]
  tips: string[]
}

const FRAME_MS = 64
const SPECTRUM_BANDS = 12

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length
  const mono = new Float32Array(length)
  const ch = buffer.numberOfChannels
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let c = 0; c < ch; c++) sum += buffer.getChannelData(c)[i]
    mono[i] = sum / ch
  }
  return mono
}

function bandEnergy(slice: Float32Array, bands: number): number[] {
  const out = new Array(bands).fill(0)
  const size = Math.max(1, Math.floor(slice.length / bands))
  for (let b = 0; b < bands; b++) {
    let sum = 0
    const start = b * size
    const end = Math.min(slice.length, start + size)
    for (let i = start; i < end; i++) sum += slice[i] * slice[i]
    out[b] = Math.sqrt(sum / Math.max(1, end - start))
  }
  return out
}

function safeFindPitch(
  detector: ReturnType<typeof PitchDetector.forFloat32Array>,
  slice: Float32Array,
  sampleRate: number,
  rms: number
): number | null {
  if (rms <= 0.008) return null
  try {
    const [hz, clarity] = detector.findPitch(slice, sampleRate)
    if (clarity > 0.7 && hz > 55 && hz < 550) return hz
  } catch {
    // pitch detection can fail on very short slices
  }
  return null
}

function extractFrames(buffer: AudioBuffer): AudioFrame[] {
  const sampleRate = buffer.sampleRate
  const mono = downmixToMono(buffer)
  const frameSamples = Math.max(512, Math.round((sampleRate * FRAME_MS) / 1000))
  const detector = PitchDetector.forFloat32Array(sampleRate)
  const frames: AudioFrame[] = []

  for (let start = 0; start + frameSamples <= mono.length; start += frameSamples) {
    const slice = mono.subarray(start, start + frameSamples)
    let sumSq = 0
    for (let i = 0; i < slice.length; i++) sumSq += slice[i] * slice[i]
    const rms = Math.sqrt(sumSq / slice.length)
    const pitch = safeFindPitch(detector, slice, sampleRate, rms)

    frames.push({
      rms,
      pitch,
      spectrum: bandEnergy(slice, SPECTRUM_BANDS),
    })
  }

  if (frames.length === 0) {
    frames.push({ rms: 0, pitch: null, spectrum: new Array(SPECTRUM_BANDS).fill(0) })
  }

  return frames
}

function normalizePitchValue(pitch: number | null, mean: number): number {
  return pitch === null ? 0 : pitch - mean
}

function pitchMean(pitches: (number | null)[]): number {
  const voiced = pitches.filter((p): p is number => p !== null)
  if (voiced.length === 0) return 0
  return voiced.reduce((s, v) => s + v, 0) / voiced.length
}

function scoreFromCorrelation(correlation: number): number {
  return clampScore((correlation + 1) * 50)
}

function scoreFromCosine(sim: number): number {
  return clampScore(((sim + 1) / 2) * 100)
}

function detectPauses(rms: number[], frameMs: number): { startMs: number; endMs: number }[] {
  const peak = Math.max(...rms, 0.001)
  const threshold = peak * 0.15
  const pauses: { startMs: number; endMs: number }[] = []
  let start: number | null = null

  for (let i = 0; i < rms.length; i++) {
    const silent = rms[i] < threshold
    if (silent && start === null) start = i
    if (!silent && start !== null) {
      const duration = (i - start) * frameMs
      if (duration >= 100) pauses.push({ startMs: start * frameMs, endMs: i * frameMs })
      start = null
    }
  }

  return pauses
}

function pauseAlignmentScore(
  refPauses: { startMs: number; endMs: number }[],
  userPauses: { startMs: number; endMs: number }[]
): number {
  if (refPauses.length === 0) return 100
  const tolerance = 280
  let matched = 0
  for (const ref of refPauses) {
    const refMid = (ref.startMs + ref.endMs) / 2
    if (userPauses.some((u) => Math.abs((u.startMs + u.endMs) / 2 - refMid) <= tolerance)) matched++
  }
  return clampScore((matched / refPauses.length) * 100)
}

function paceScore(refDuration: number, userDuration: number): number {
  if (refDuration <= 0 || userDuration <= 0) return 0
  return clampScore(100 - Math.abs(1 - userDuration / refDuration) * 200)
}

function buildDiffRegions(
  refFrames: AudioFrame[],
  userFrames: AudioFrame[],
  alignment: { refIdx: number; userIdx: number }[],
  frameMs: number
): VoiceDiffRegion[] {
  const chunk = Math.max(3, Math.floor(alignment.length / 6))
  const regions: VoiceDiffRegion[] = []
  const refMean = pitchMean(refFrames.map((f) => f.pitch))
  const userMean = pitchMean(userFrames.map((f) => f.pitch))

  for (let i = 0; i < alignment.length; i += chunk) {
    const slice = alignment.slice(i, i + chunk)
    const refRms = slice.map((p) => refFrames[p.refIdx]?.rms ?? 0)
    const userRms = slice.map((p) => userFrames[p.userIdx]?.rms ?? 0)
    const refPitchNorm = slice.map((p) =>
      normalizePitchValue(refFrames[p.refIdx]?.pitch ?? null, refMean)
    )
    const userPitchNorm = slice.map((p) =>
      normalizePitchValue(userFrames[p.userIdx]?.pitch ?? null, userMean)
    )

    const flowCorr = pearsonCorrelation(refRms, userRms)
    const toneCorr = pearsonCorrelation(refPitchNorm, userPitchNorm)
    const specSims = slice.map((p) =>
      cosineSimilarity(refFrames[p.refIdx]?.spectrum ?? [], userFrames[p.userIdx]?.spectrum ?? [])
    )
    const soundSim = specSims.reduce((s, v) => s + v, 0) / Math.max(specSims.length, 1)

    const scores = [
      { layer: 'flow' as const, score: scoreFromCorrelation(flowCorr) },
      { layer: 'tone' as const, score: scoreFromCorrelation(toneCorr) },
      { layer: 'sound' as const, score: scoreFromCosine(soundSim) },
    ]
    const worst = scores.reduce((a, b) => (a.score <= b.score ? a : b))
    const severity = clampScore(100 - worst.score) / 100
    if (severity < 0.25) continue

    let tip = 'Listen closely and try to match the reciter here.'
    if (worst.layer === 'tone') tip = "Match the reciter's rise and fall in this phrase."
    if (worst.layer === 'sound') tip = "Try to copy how the reciter's voice sounds on each syllable."
    if (worst.layer === 'flow') tip = "Match the reciter's pace and pauses in this section."

    regions.push({
      startMs: slice[0].refIdx * frameMs,
      endMs: (slice[slice.length - 1].refIdx + 1) * frameMs,
      layer: worst.layer,
      severity,
      tip,
    })
  }

  return regions.slice(0, 5)
}

function buildTips(tone: number, sound: number, flow: number, regions: VoiceDiffRegion[]): string[] {
  const ordered = [
    { score: tone, tip: "Focus on matching the reciter's intonation." },
    { score: sound, tip: "Copy the reciter's voice color on each word." },
    { score: flow, tip: "Match the reciter's rhythm and pauses." },
  ].sort((a, b) => a.score - b.score)

  const tips = [ordered[0].tip]
  if (regions[0]?.tip) tips.push(regions[0].tip)
  if (ordered[0].score >= 70) tips.push('Good effort — try again to improve your score.')
  return [...new Set(tips)].slice(0, 3)
}

export async function analyzeVoiceSimilarity(
  reference: AudioInput,
  userRecording: AudioInput
): Promise<VoiceSimilarityResult> {
  let refBuffer: AudioBuffer
  let userBuffer: AudioBuffer

  try {
    refBuffer = await decodeToAudioBuffer(reference)
  } catch {
    throw new Error('Could not load reciter audio — connect to the internet and tap Listen first')
  }

  try {
    userBuffer = await decodeToAudioBuffer(userRecording)
  } catch {
    throw new Error('Could not read your recording')
  }

  if (userBuffer.duration < 0.2) {
    throw new Error('Recording too short')
  }

  if (refBuffer.duration < 0.1) {
    throw new Error('Reciter audio is invalid')
  }

  const refFrames = extractFrames(refBuffer)
  const userFrames = extractFrames(userBuffer)
  const refRms = refFrames.map((f) => f.rms)
  const userRms = userFrames.map((f) => f.rms)
  const alignment = dtwAlign(refRms, userRms)

  if (alignment.length === 0) {
    throw new Error('Could not align audio')
  }

  const refMean = pitchMean(refFrames.map((f) => f.pitch))
  const userMean = pitchMean(userFrames.map((f) => f.pitch))
  const alignedRefPitch = alignment.map((p) =>
    normalizePitchValue(refFrames[p.refIdx]?.pitch ?? null, refMean)
  )
  const alignedUserPitch = alignment.map((p) =>
    normalizePitchValue(userFrames[p.userIdx]?.pitch ?? null, userMean)
  )
  const tone = scoreFromCorrelation(pearsonCorrelation(alignedRefPitch, alignedUserPitch))

  const specSims = alignment.map((p) =>
    cosineSimilarity(refFrames[p.refIdx]?.spectrum ?? [], userFrames[p.userIdx]?.spectrum ?? [])
  )
  const sound = scoreFromCosine(
    specSims.reduce((s, v) => s + v, 0) / Math.max(specSims.length, 1)
  )

  const alignedRefRms = alignment.map((p) => refFrames[p.refIdx]?.rms ?? 0)
  const alignedUserRms = alignment.map((p) => userFrames[p.userIdx]?.rms ?? 0)
  const rhythmCorr = scoreFromCorrelation(pearsonCorrelation(alignedRefRms, alignedUserRms))
  const pauseScore = pauseAlignmentScore(detectPauses(refRms, FRAME_MS), detectPauses(userRms, FRAME_MS))
  const pace = paceScore(refBuffer.duration, userBuffer.duration)
  const flow = clampScore(rhythmCorr * 0.4 + pauseScore * 0.35 + pace * 0.25)

  const voiceSimilarity = clampScore(tone * 0.35 + sound * 0.35 + flow * 0.3)
  const diffRegions = buildDiffRegions(refFrames, userFrames, alignment, FRAME_MS)

  return {
    voiceSimilarity,
    tone,
    sound,
    flow,
    refWaveform: refRms,
    userWaveform: userRms,
    refPitch: refFrames.map((f) => f.pitch),
    userPitch: userFrames.map((f) => f.pitch),
    diffRegions,
    tips: buildTips(tone, sound, flow, diffRegions),
  }
}
