import { PitchDetector } from 'pitchy'
import { clampScore, cosineSimilarity, dtwAlign, pearsonCorrelation, type DtwPair } from '@/lib/dtw'
import { decodeToAudioBuffer, type AudioInput } from '@/lib/audio-decode'

export type { AudioInput } from '@/lib/audio-decode'

export const ANALYSIS_FRAME_MS = 48
const SPECTRUM_BANDS = 20
const DISPLAY_POINTS = 280
const ALIGNED_POINTS = 240

export interface AudioFrame {
  rms: number
  pitch: number | null
  spectrum: number[]
  centroid: number
  zcr: number
  voiced: boolean
}

export interface VoiceDiffRegion {
  startMs: number
  endMs: number
  layer: 'tone' | 'sound' | 'flow'
  severity: number
  tip: string
}

export interface VoiceAnalysisDetail {
  pitchContour: number
  pitchRange: number
  voicedMatch: number
  spectralMatch: number
  voiceColor: number
  brightness: number
  rhythm: number
  pauses: number
  pace: number
  onsets: number
  alignmentQuality: number
}

export interface VoiceSimilarityResult {
  voiceSimilarity: number
  tone: number
  sound: number
  flow: number
  detail: VoiceAnalysisDetail
  refWaveform: number[]
  userWaveform: number[]
  alignedRef: number[]
  alignedUser: number[]
  matchHeatmap: number[]
  refPitch: (number | null)[]
  userPitch: (number | null)[]
  alignedRefPitch: (number | null)[]
  alignedUserPitch: (number | null)[]
  diffRegions: VoiceDiffRegion[]
  tips: string[]
  durationMs: number
  frameMs: number
}

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

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700)
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1)
}

function melFrequencies(bands: number, sampleRate: number): number[] {
  const minMel = hzToMel(80)
  const maxMel = hzToMel(Math.min(3800, sampleRate / 2 - 50))
  const freqs: number[] = []
  for (let i = 0; i < bands; i++) {
    const mel = minMel + (i / Math.max(bands - 1, 1)) * (maxMel - minMel)
    freqs.push(melToHz(mel))
  }
  return freqs
}

function hannWindow(slice: Float32Array): Float32Array {
  const out = new Float32Array(slice.length)
  const n = slice.length
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(n - 1, 1)))
    out[i] = slice[i] * w
  }
  return out
}

function goertzelPower(samples: Float32Array, sampleRate: number, targetHz: number): number {
  const omega = (2 * Math.PI * targetHz) / sampleRate
  const coeff = 2 * Math.cos(omega)
  let s0 = 0
  let s1 = 0
  let s2 = 0
  for (let i = 0; i < samples.length; i++) {
    s0 = samples[i] + coeff * s1 - s2
    s2 = s1
    s1 = s0
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2)
}

function melSpectrum(slice: Float32Array, sampleRate: number, freqs: number[]): number[] {
  const windowed = hannWindow(slice)
  return freqs.map((hz) => Math.sqrt(goertzelPower(windowed, sampleRate, hz)))
}

function spectralCentroid(spectrum: number[], freqs: number[]): number {
  let weighted = 0
  let total = 0
  for (let i = 0; i < spectrum.length; i++) {
    weighted += spectrum[i] * freqs[i]
    total += spectrum[i]
  }
  return total > 0 ? weighted / total : 0
}

function zeroCrossingRate(slice: Float32Array): number {
  let crossings = 0
  for (let i = 1; i < slice.length; i++) {
    if ((slice[i - 1] >= 0 && slice[i] < 0) || (slice[i - 1] < 0 && slice[i] >= 0)) crossings++
  }
  return crossings / Math.max(slice.length - 1, 1)
}

function safeFindPitch(
  detector: ReturnType<typeof PitchDetector.forFloat32Array>,
  slice: Float32Array,
  sampleRate: number,
  rms: number
): number | null {
  if (rms <= 0.006) return null
  try {
    const [hz, clarity] = detector.findPitch(slice, sampleRate)
    if (clarity > 0.65 && hz > 55 && hz < 580) return hz
  } catch {
    // short or noisy slices
  }
  return null
}

function extractFrames(buffer: AudioBuffer): AudioFrame[] {
  const sampleRate = buffer.sampleRate
  const mono = downmixToMono(buffer)
  const frameSamples = Math.max(1024, Math.round((sampleRate * ANALYSIS_FRAME_MS) / 1000))
  const melFreqs = melFrequencies(SPECTRUM_BANDS, sampleRate)
  const detector = PitchDetector.forFloat32Array(sampleRate)
  const frames: AudioFrame[] = []

  for (let start = 0; start + frameSamples <= mono.length; start += frameSamples) {
    const slice = mono.subarray(start, start + frameSamples)
    let sumSq = 0
    for (let i = 0; i < slice.length; i++) sumSq += slice[i] * slice[i]
    const rms = Math.sqrt(sumSq / slice.length)
    const pitch = safeFindPitch(detector, slice, sampleRate, rms)
    const spectrum = melSpectrum(slice, sampleRate, melFreqs)

    frames.push({
      rms,
      pitch,
      spectrum,
      centroid: spectralCentroid(spectrum, melFreqs),
      zcr: zeroCrossingRate(slice),
      voiced: pitch !== null,
    })
  }

  if (frames.length === 0) {
    frames.push({
      rms: 0,
      pitch: null,
      spectrum: new Array(SPECTRUM_BANDS).fill(0),
      centroid: 0,
      zcr: 0,
      voiced: false,
    })
  }

  return frames
}

export function extractPeakWaveform(buffer: AudioBuffer, points: number): number[] {
  const mono = downmixToMono(buffer)
  const block = Math.max(1, Math.floor(mono.length / points))
  const peaks: number[] = []
  for (let i = 0; i < points; i++) {
    let peak = 0
    const start = i * block
    const end = Math.min(mono.length, start + block)
    for (let j = start; j < end; j++) peak = Math.max(peak, Math.abs(mono[j]))
    peaks.push(peak)
  }
  return peaks
}

function resampleSeries<T>(series: T[], targetLen: number, filler: T): T[] {
  if (series.length === 0) return []
  if (series.length === targetLen) return [...series]
  const out: T[] = []
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.min(series.length - 1, Math.floor((i / targetLen) * series.length))
    out.push(series[idx] ?? filler)
  }
  return out
}

function buildAlignedSeries(
  alignment: DtwPair[],
  refValues: number[],
  userValues: number[],
  targetLen: number
): { ref: number[]; user: number[]; heatmap: number[] } {
  if (alignment.length === 0) return { ref: [], user: [], heatmap: [] }
  const ref: number[] = []
  const user: number[] = []
  const heatmap: number[] = []
  const peakRef = Math.max(...refValues, 0.001)
  const peakUser = Math.max(...userValues, 0.001)

  for (let i = 0; i < targetLen; i++) {
    const idx = Math.min(alignment.length - 1, Math.floor((i / targetLen) * alignment.length))
    const pair = alignment[idx]
    const r = refValues[pair.refIdx] ?? 0
    const u = userValues[pair.userIdx] ?? 0
    ref.push(r / peakRef)
    user.push(u / peakUser)
    heatmap.push(Math.min(1, Math.abs(r / peakRef - u / peakUser)))
  }

  return { ref, user, heatmap }
}

function buildAlignedPitch(
  alignment: DtwPair[],
  refPitch: (number | null)[],
  userPitch: (number | null)[],
  targetLen: number
): { ref: (number | null)[]; user: (number | null)[] } {
  const ref: (number | null)[] = []
  const user: (number | null)[] = []
  for (let i = 0; i < targetLen; i++) {
    const idx = Math.min(alignment.length - 1, Math.floor((i / targetLen) * alignment.length))
    const pair = alignment[idx]
    ref.push(refPitch[pair.refIdx] ?? null)
    user.push(userPitch[pair.userIdx] ?? null)
  }
  return { ref, user }
}

function normalizePitchValue(pitch: number | null, mean: number): number {
  return pitch === null ? 0 : pitch - mean
}

function pitchMean(pitches: (number | null)[]): number {
  const voiced = pitches.filter((p): p is number => p !== null)
  if (voiced.length === 0) return 0
  return voiced.reduce((s, v) => s + v, 0) / voiced.length
}

function pitchRange(pitches: (number | null)[]): number {
  const voiced = pitches.filter((p): p is number => p !== null)
  if (voiced.length < 2) return 0
  return Math.max(...voiced) - Math.min(...voiced)
}

function scoreFromCorrelation(correlation: number): number {
  return clampScore((correlation + 1) * 50)
}

function scoreFromCosine(sim: number): number {
  return clampScore(((sim + 1) / 2) * 100)
}

function ratioScore(reference: number, value: number, tolerance = 0.35): number {
  if (reference <= 0) return value <= 0 ? 100 : 60
  const ratio = value / reference
  const delta = Math.abs(1 - ratio)
  return clampScore(100 - (delta / tolerance) * 100)
}

function detectPauses(rms: number[], frameMs: number): { startMs: number; endMs: number }[] {
  const peak = Math.max(...rms, 0.001)
  const threshold = peak * 0.14
  const pauses: { startMs: number; endMs: number }[] = []
  let start: number | null = null

  for (let i = 0; i < rms.length; i++) {
    const silent = rms[i] < threshold
    if (silent && start === null) start = i
    if (!silent && start !== null) {
      const duration = (i - start) * frameMs
      if (duration >= 90) pauses.push({ startMs: start * frameMs, endMs: i * frameMs })
      start = null
    }
  }

  return pauses
}

function detectOnsets(rms: number[], frameMs: number): number[] {
  const onsets: number[] = []
  const peak = Math.max(...rms, 0.001)
  for (let i = 1; i < rms.length; i++) {
    const rise = rms[i] - rms[i - 1]
    if (rise > peak * 0.08 && rms[i] > peak * 0.12) onsets.push(i * frameMs)
  }
  return onsets
}

function pauseAlignmentScore(
  refPauses: { startMs: number; endMs: number }[],
  userPauses: { startMs: number; endMs: number }[]
): number {
  if (refPauses.length === 0) return 100
  const tolerance = 260
  let matched = 0
  for (const ref of refPauses) {
    const refMid = (ref.startMs + ref.endMs) / 2
    if (userPauses.some((u) => Math.abs((u.startMs + u.endMs) / 2 - refMid) <= tolerance)) matched++
  }
  return clampScore((matched / refPauses.length) * 100)
}

function onsetAlignmentScore(refOnsets: number[], userOnsets: number[]): number {
  if (refOnsets.length === 0) return 100
  const tolerance = 220
  let matched = 0
  for (const ref of refOnsets) {
    if (userOnsets.some((u) => Math.abs(u - ref) <= tolerance)) matched++
  }
  return clampScore((matched / refOnsets.length) * 100)
}

function paceScore(refDuration: number, userDuration: number): number {
  if (refDuration <= 0 || userDuration <= 0) return 0
  return clampScore(100 - Math.abs(1 - userDuration / refDuration) * 180)
}

function voicedRatioScore(refFrames: AudioFrame[], userFrames: AudioFrame[]): number {
  const refRatio = refFrames.filter((f) => f.voiced).length / refFrames.length
  const userRatio = userFrames.filter((f) => f.voiced).length / userFrames.length
  return ratioScore(refRatio, userRatio, 0.45)
}

function alignmentQualityScore(alignment: DtwPair[], refRms: number[], userRms: number[]): number {
  if (alignment.length === 0) return 0
  let cost = 0
  const peak = Math.max(...refRms, ...userRms, 0.001)
  for (const pair of alignment) {
    cost += Math.abs((refRms[pair.refIdx] ?? 0) - (userRms[pair.userIdx] ?? 0)) / peak
  }
  const avg = cost / alignment.length
  return clampScore(100 - avg * 120)
}

function buildDiffRegions(
  refFrames: AudioFrame[],
  userFrames: AudioFrame[],
  alignment: DtwPair[],
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
    const specSims = slice.map((p) =>
      cosineSimilarity(refFrames[p.refIdx]?.spectrum ?? [], userFrames[p.userIdx]?.spectrum ?? [])
    )
    const centroidSims = slice.map((p) => {
      const r = refFrames[p.refIdx]?.centroid ?? 0
      const u = userFrames[p.userIdx]?.centroid ?? 0
      const denom = Math.max(r, u, 1)
      return 1 - Math.abs(r - u) / denom
    })
    const soundSim =
      (specSims.reduce((s, v) => s + v, 0) / Math.max(specSims.length, 1)) * 0.7 +
      (centroidSims.reduce((s, v) => s + v, 0) / Math.max(centroidSims.length, 1)) * 0.3

    const scores = [
      { layer: 'flow' as const, score: scoreFromCorrelation(flowCorr) },
      { layer: 'tone' as const, score: scoreFromCorrelation(toneCorr) },
      { layer: 'sound' as const, score: scoreFromCosine(soundSim) },
    ]
    const worst = scores.reduce((a, b) => (a.score <= b.score ? a : b))
    const severity = clampScore(100 - worst.score) / 100
    if (severity < 0.2) continue

    let tip = 'Listen closely and try to match the reciter here.'
    if (worst.layer === 'tone') tip = "Match the reciter's rise and fall — stretch or compress your melody."
    if (worst.layer === 'sound') tip = "Open or soften your voice to match the reciter's tone color here."
    if (worst.layer === 'flow') tip = 'Slow down or speed up to match the reciter’s rhythm and pauses.'

    regions.push({
      startMs: slice[0].refIdx * frameMs,
      endMs: (slice[slice.length - 1].refIdx + 1) * frameMs,
      layer: worst.layer,
      severity,
      tip,
    })
  }

  return regions.sort((a, b) => b.severity - a.severity).slice(0, 6)
}

function buildTips(
  tone: number,
  sound: number,
  flow: number,
  detail: VoiceAnalysisDetail,
  regions: VoiceDiffRegion[]
): string[] {
  const candidates = [
    { score: tone, tip: "Focus on matching the reciter's intonation curve." },
    { score: sound, tip: "Copy the reciter's voice color — brightness and depth." },
    { score: flow, tip: "Match the reciter's rhythm, pauses, and word starts." },
    { score: detail.pitchRange, tip: 'Use more (or less) pitch movement like the reciter.' },
    { score: detail.pauses, tip: 'Place your pauses where the reciter breathes.' },
    { score: detail.onsets, tip: 'Start each word at the same moment as the reciter.' },
    { score: detail.brightness, tip: 'Brighten or soften your voice to match the reciter.' },
  ].sort((a, b) => a.score - b.score)

  const tips = [candidates[0].tip]
  if (regions[0]?.tip) tips.push(regions[0].tip)
  if (candidates[0].score >= 72) tips.push('Strong match — one more pass can push you higher.')
  return [...new Set(tips)].slice(0, 4)
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

  if (userBuffer.duration < 0.2) throw new Error('Recording too short')
  if (refBuffer.duration < 0.1) throw new Error('Reciter audio is invalid')

  const refFrames = extractFrames(refBuffer)
  const userFrames = extractFrames(userBuffer)
  const refRms = refFrames.map((f) => f.rms)
  const userRms = userFrames.map((f) => f.rms)
  const alignment = dtwAlign(refRms, userRms)

  if (alignment.length === 0) throw new Error('Could not align audio')

  const refMean = pitchMean(refFrames.map((f) => f.pitch))
  const userMean = pitchMean(userFrames.map((f) => f.pitch))
  const alignedRefPitch = alignment.map((p) =>
    normalizePitchValue(refFrames[p.refIdx]?.pitch ?? null, refMean)
  )
  const alignedUserPitch = alignment.map((p) =>
    normalizePitchValue(userFrames[p.userIdx]?.pitch ?? null, userMean)
  )

  const pitchContour = scoreFromCorrelation(pearsonCorrelation(alignedRefPitch, alignedUserPitch))
  const pitchRangeMatch = ratioScore(pitchRange(refFrames.map((f) => f.pitch)), pitchRange(userFrames.map((f) => f.pitch)))
  const voicedMatch = voicedRatioScore(refFrames, userFrames)
  const tone = clampScore(pitchContour * 0.5 + pitchRangeMatch * 0.25 + voicedMatch * 0.25)

  const specSims = alignment.map((p) =>
    cosineSimilarity(refFrames[p.refIdx]?.spectrum ?? [], userFrames[p.userIdx]?.spectrum ?? [])
  )
  const spectralMatch = scoreFromCosine(
    specSims.reduce((s, v) => s + v, 0) / Math.max(specSims.length, 1)
  )

  const alignedRefCentroid = alignment.map((p) => refFrames[p.refIdx]?.centroid ?? 0)
  const alignedUserCentroid = alignment.map((p) => userFrames[p.userIdx]?.centroid ?? 0)
  const brightness = scoreFromCorrelation(pearsonCorrelation(alignedRefCentroid, alignedUserCentroid))

  const alignedRefZcr = alignment.map((p) => refFrames[p.refIdx]?.zcr ?? 0)
  const alignedUserZcr = alignment.map((p) => userFrames[p.userIdx]?.zcr ?? 0)
  const voiceColor = scoreFromCorrelation(pearsonCorrelation(alignedRefZcr, alignedUserZcr))

  const sound = clampScore(spectralMatch * 0.55 + brightness * 0.25 + voiceColor * 0.2)

  const alignedRefRms = alignment.map((p) => refFrames[p.refIdx]?.rms ?? 0)
  const alignedUserRms = alignment.map((p) => userFrames[p.userIdx]?.rms ?? 0)
  const rhythm = scoreFromCorrelation(pearsonCorrelation(alignedRefRms, alignedUserRms))
  const pauses = pauseAlignmentScore(detectPauses(refRms, ANALYSIS_FRAME_MS), detectPauses(userRms, ANALYSIS_FRAME_MS))
  const pace = paceScore(refBuffer.duration, userBuffer.duration)
  const onsets = onsetAlignmentScore(detectOnsets(refRms, ANALYSIS_FRAME_MS), detectOnsets(userRms, ANALYSIS_FRAME_MS))
  const flow = clampScore(rhythm * 0.35 + pauses * 0.3 + pace * 0.2 + onsets * 0.15)

  const alignmentQuality = alignmentQualityScore(alignment, refRms, userRms)
  const voiceSimilarity = clampScore(
    tone * 0.34 + sound * 0.34 + flow * 0.32 + alignmentQuality * 0.05 - (alignmentQuality < 40 ? 8 : 0)
  )

  const detail: VoiceAnalysisDetail = {
    pitchContour,
    pitchRange: pitchRangeMatch,
    voicedMatch,
    spectralMatch,
    voiceColor,
    brightness,
    rhythm,
    pauses,
    pace,
    onsets,
    alignmentQuality,
  }

  const diffRegions = buildDiffRegions(refFrames, userFrames, alignment, ANALYSIS_FRAME_MS)
  const aligned = buildAlignedSeries(alignment, refRms, userRms, ALIGNED_POINTS)
  const alignedPitch = buildAlignedPitch(
    alignment,
    refFrames.map((f) => f.pitch),
    userFrames.map((f) => f.pitch),
    ALIGNED_POINTS
  )

  const durationMs = Math.round(Math.max(refBuffer.duration, userBuffer.duration) * 1000)

  return {
    voiceSimilarity,
    tone,
    sound,
    flow,
    detail,
    refWaveform: extractPeakWaveform(refBuffer, DISPLAY_POINTS),
    userWaveform: extractPeakWaveform(userBuffer, DISPLAY_POINTS),
    alignedRef: aligned.ref,
    alignedUser: aligned.user,
    matchHeatmap: aligned.heatmap,
    refPitch: resampleSeries(
      refFrames.map((f) => f.pitch),
      DISPLAY_POINTS,
      null
    ),
    userPitch: resampleSeries(
      userFrames.map((f) => f.pitch),
      DISPLAY_POINTS,
      null
    ),
    alignedRefPitch: alignedPitch.ref,
    alignedUserPitch: alignedPitch.user,
    diffRegions,
    tips: buildTips(tone, sound, flow, detail, diffRegions),
    durationMs,
    frameMs: ANALYSIS_FRAME_MS,
  }
}
