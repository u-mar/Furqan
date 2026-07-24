export interface PracticeRecord {
  reciterId: string
  surah: number
  ayah: number
  voiceSimilarity: number
  tone: number
  sound: number
  flow: number
  practicedAt: string
  attempts: number
  /** Highest voiceSimilarity ever reached on this ayah with this reciter. */
  bestVoiceSimilarity: number
  /** Recent similarity scores (oldest → newest), capped, for the improvement sparkline. */
  history: number[]
}

/** Result of saving an attempt — enough to celebrate progress in the UI. */
export interface SaveResult {
  record: PracticeRecord
  /** Similarity of the immediately-previous attempt, or null on the first try. */
  previousLast: number | null
  /** Best similarity before this attempt, or null on the first try. */
  previousBest: number | null
  /** True when this attempt beat the previous personal best. */
  isNewBest: boolean
  /** True when this is the very first attempt on this ayah. */
  isFirst: boolean
  /** current − previousLast (points), or null on the first try. */
  delta: number | null
}

const STORAGE_KEY = 'muyassar_imitate_progress'
const HISTORY_CAP = 14

interface SkillLevel {
  index: number
  name: string
  min: number
}

/** Progression ladder shown on the Imitate home screen. */
export const SKILL_LEVELS: SkillLevel[] = [
  { index: 0, name: 'Beginner', min: 0 },
  { index: 1, name: 'Learner', min: 40 },
  { index: 2, name: 'Reciter', min: 55 },
  { index: 3, name: 'Skilled', min: 68 },
  { index: 4, name: 'Advanced', min: 80 },
  { index: 5, name: 'Master', min: 90 },
]

export interface ImitateStats {
  totalAttempts: number
  distinctAyahs: number
  bestOverall: number
  /** Average of each ayah's personal best — the basis for the skill level. */
  avgBest: number
  level: SkillLevel
  nextLevel: SkillLevel | null
  /** 0–100 progress toward the next level. */
  progressToNext: number
}

function readAll(): PracticeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PracticeRecord[]
    if (!Array.isArray(parsed)) return []
    // Backfill fields added in later versions so older saves stay valid.
    return parsed.map((r) => ({
      ...r,
      bestVoiceSimilarity: r.bestVoiceSimilarity ?? r.voiceSimilarity ?? 0,
      history: Array.isArray(r.history) ? r.history : [r.voiceSimilarity ?? 0],
    }))
  } catch {
    return []
  }
}

function writeAll(records: PracticeRecord[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function savePracticeRecord(
  record: Omit<PracticeRecord, 'practicedAt' | 'attempts' | 'bestVoiceSimilarity' | 'history'>
): SaveResult {
  const records = readAll()
  const key = `${record.reciterId}:${record.surah}:${record.ayah}`
  const existing = records.find((r) => `${r.reciterId}:${r.surah}:${r.ayah}` === key)

  const previousLast = existing ? existing.voiceSimilarity : null
  const previousBest = existing ? existing.bestVoiceSimilarity : null
  const bestVoiceSimilarity = Math.max(record.voiceSimilarity, previousBest ?? 0)
  const history = [...(existing?.history ?? []), record.voiceSimilarity].slice(-HISTORY_CAP)

  const next: PracticeRecord = {
    ...record,
    practicedAt: new Date().toISOString(),
    attempts: (existing?.attempts ?? 0) + 1,
    bestVoiceSimilarity,
    history,
  }

  const filtered = records.filter((r) => `${r.reciterId}:${r.surah}:${r.ayah}` !== key)
  filtered.unshift(next)
  writeAll(filtered.slice(0, 200))

  return {
    record: next,
    previousLast,
    previousBest,
    isNewBest: previousBest !== null && record.voiceSimilarity > previousBest,
    isFirst: existing === undefined,
    delta: previousLast !== null ? record.voiceSimilarity - previousLast : null,
  }
}

export function getRecentPractice(limit = 10): PracticeRecord[] {
  return readAll().slice(0, limit)
}

export function getBestForAyah(reciterId: string, surah: number, ayah: number): PracticeRecord | null {
  return readAll().find((r) => r.reciterId === reciterId && r.surah === surah && r.ayah === ayah) ?? null
}

function levelForScore(score: number): { level: SkillLevel; next: SkillLevel | null; progress: number } {
  let level = SKILL_LEVELS[0]
  for (const l of SKILL_LEVELS) {
    if (score >= l.min) level = l
  }
  const next = SKILL_LEVELS[level.index + 1] ?? null
  const progress = next
    ? Math.round(((score - level.min) / (next.min - level.min)) * 100)
    : 100
  return { level, next, progress: Math.max(0, Math.min(100, progress)) }
}

export function getImitateStats(): ImitateStats {
  const records = readAll()
  const totalAttempts = records.reduce((sum, r) => sum + (r.attempts || 1), 0)
  const bests = records.map((r) => r.bestVoiceSimilarity)
  const bestOverall = bests.length ? Math.max(...bests) : 0
  const avgBest = bests.length ? Math.round(bests.reduce((s, v) => s + v, 0) / bests.length) : 0
  const { level, next, progress } = levelForScore(avgBest)

  return {
    totalAttempts,
    distinctAyahs: records.length,
    bestOverall,
    avgBest,
    level,
    nextLevel: next,
    progressToNext: progress,
  }
}
