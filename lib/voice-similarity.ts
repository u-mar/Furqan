import Meyda from 'meyda'
import { PitchDetector } from 'pitchy'
import { clampScore, cosineSimilarity, dtwAlign, pearsonCorrelation } from '@/lib/dtw'

export interface AudioFrame {
  rms: number
  pitch: number | null
  mfcc: number[]
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

const FRAME_MS = 50
const MFCC_SIZE = 13

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

export async function decodeAudioSource(source: Blob | ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new AudioContext()
  const arrayBuffer = source instanceof Blob ? await source.arrayBuffer() : source
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    await ctx.close()
  }
}

function extractFrames(buffer: AudioBuffer): AudioFrame[] {
  const sampleRate = buffer.sampleRate
  const mono = downmixToMono(buffer)
  const frameSamples = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000))
  const detector = PitchDetector.forFloat32Array(sampleRate)
  const frames: AudioFrame[] = []

  Meyda.bufferSize = frameSamples
  Meyda.sampleRate = sampleRate

  for (let start = 0; start + frameSamples <= mono.length; start += frameSamples) {
    const slice = mono.subarray(start, start + frameSamples)
    let sumSq = 0
    for (let i = 0; i < slice.length; i++) sumSq += slice[i] * slice[i]
    const rms = Math.sqrt(sumSq / slice.length)

    let pitch: number | null = null
    if (rms > 0.01) {
      const [hz, clarity] = detector.findPitch(slice, sampleRate)
      if (clarity > 0.85 && hz > 60 && hz < 500) pitch = hz
    }

    let mfcc = new Array(MFCC_SIZE).fill(0)
    try {
      const extracted = Meyda.extract('mfcc', slice) as Record<string, number | number[]>
      if (Array.isArray(extracted.mfcc)) {
        mfcc = extracted.mfcc.slice(0, MFCC_SIZE)
      }
    } catch {
      mfcc = [rms, pitch ?? 0, ...new Array(MFCC_SIZE - 2).fill(0)]
    }

    frames.push({ rms, pitch, mfcc })
  }

  if (frames.length === 0) {
    frames.push({ rms: 0, pitch: null, mfcc: new Array(MFCC_SIZE).fill(0) })
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
      if (duration >= 120) {
        pauses.push({ startMs: start * frameMs, endMs: i * frameMs })
      }
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
  const tolerance = 250
  let matched = 0
  for (const ref of refPauses) {
    const refMid = (ref.startMs + ref.endMs) / 2
    const hit = userPauses.some((u) => {
      const mid = (u.startMs + u.endMs) / 2
      return Math.abs(mid - refMid) <= tolerance
    })
    if (hit) matched++
  }
  return clampScore((matched / refPauses.length) * 100)
}

function paceScore(refDuration: number, userDuration: number): number {
  if (refDuration <= 0 || userDuration <= 0) return 0
  const ratio = userDuration / refDuration
  return clampScore(100 - Math.abs(1 - ratio) * 200)
}

function buildDiffRegions(
  refFrames: AudioFrame[],
  userFrames: AudioFrame[],
  alignment: { refIdx: number; userIdx: number }[],
  frameMs: number
): VoiceDiffRegion[] {
  const chunk = Math.max(4, Math.floor(alignment.length / 8))
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
    const mfccSims = slice.map((p) =>
      cosineSimilarity(refFrames[p.refIdx]?.mfcc ?? [], userFrames[p.userIdx]?.mfcc ?? [])
    )
    const soundSim = mfccSims.reduce((s, v) => s + v, 0) / Math.max(mfccSims.length, 1)

    const scores = [
      { layer: 'flow' as const, score: scoreFromCorrelation(flowCorr) },
      { layer: 'tone' as const, score: scoreFromCorrelation(toneCorr) },
      { layer: 'sound' as const, score: scoreFromCosine(soundSim) },
    ]
    const worst = scores.reduce((a, b) => (a.score <= b.score ? a : b))
    const severity = clampScore(100 - worst.score) / 100
    if (severity < 0.25) continue

    const startMs = slice[0].refIdx * frameMs
    const endMs = (slice[slice.length - 1].refIdx + 1) * frameMs
    let tip = 'Listen closely and try to match the reciter here.'
    if (worst.layer === 'tone') tip = "Match the reciter's rise and fall in this phrase."
    if (worst.layer === 'sound') tip = "Try to copy the fullness and tone color of the reciter's voice."
    if (worst.layer === 'flow') tip = "Match the reciter's pace and pauses in this section."

    regions.push({ startMs, endMs, layer: worst.layer, severity, tip })
  }

  return regions.slice(0, 6)
}

function buildTips(tone: number, sound: number, flow: number, regions: VoiceDiffRegion[]): string[] {
  const ordered = [
    { score: tone, tip: "Focus on matching the reciter's intonation — when their voice rises and falls." },
    { score: sound, tip: "Listen to the reciter's voice color and try to copy how each syllable sounds." },
    { score: flow, tip: "Match the reciter's rhythm — pauses, pace, and how long sounds are held." },
  ].sort((a, b) => a.score - b.score)

  const tips = [ordered[0].tip]
  if (regions[0]?.tip) tips.push(regions[0].tip)
  if (ordered[0].score >= 75) tips.push('Good progress — keep practicing this ayah to refine your match.')
  return [...new Set(tips)].slice(0, 3)
}

export async function analyzeVoiceSimilarity(
  reference: Blob | ArrayBuffer,
  userRecording: Blob
): Promise<VoiceSimilarityResult> {
  const [refBuffer, userBuffer] = await Promise.all([
    decodeAudioSource(reference),
    decodeAudioSource(userRecording),
  ])

  const refFrames = extractFrames(refBuffer)
  const userFrames = extractFrames(userBuffer)
  const refRms = refFrames.map((f) => f.rms)
  const userRms = userFrames.map((f) => f.rms)
  const alignment = dtwAlign(refRms, userRms)

  const refMean = pitchMean(refFrames.map((f) => f.pitch))
  const userMean = pitchMean(userFrames.map((f) => f.pitch))
  const alignedRefPitch = alignment.map((p) =>
    normalizePitchValue(refFrames[p.refIdx]?.pitch ?? null, refMean)
  )
  const alignedUserPitch = alignment.map((p) =>
    normalizePitchValue(userFrames[p.userIdx]?.pitch ?? null, userMean)
  )
  const tone = scoreFromCorrelation(pearsonCorrelation(alignedRefPitch, alignedUserPitch))

  const mfccSimilarities = alignment.map((p) =>
    cosineSimilarity(refFrames[p.refIdx]?.mfcc ?? [], userFrames[p.userIdx]?.mfcc ?? [])
  )
  const avgMfcc = mfccSimilarities.reduce((s, v) => s + v, 0) / Math.max(mfccSimilarities.length, 1)
  const sound = scoreFromCosine(avgMfcc)

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
