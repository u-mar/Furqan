/**
 * Memory for hifdh practice — how well each ayah is known, and when it should
 * come back.
 *
 * A trimmed SM-2: every graded ayah carries an ease factor and an interval.
 * Intervals are held in minutes rather than days because a missed ayah should
 * reappear inside the same sitting, not tomorrow.
 */

const STORAGE_KEY = 'muyassar_hifdh_v1'
const EVENT_NAME = 'hifdh-progress-changed'

export type Grade = 'got' | 'shaky' | 'missed'

export interface AyahMemory {
  verseKey: string
  /** SM-2 ease — higher means the interval grows faster. */
  ease: number
  /** Minutes until this ayah is due again. */
  intervalMin: number
  dueAt: number
  /** Consecutive clean recalls. */
  streak: number
  attempts: number
  misses: number
  lastGrade: Grade
  lastSeenAt: number
}

interface HifdhStore {
  version: 1
  ayahs: Record<string, AyahMemory>
  /** ISO day strings on which at least one ayah was graded. */
  days: string[]
}

const MINUTE = 60_000
const MIN_EASE = 1.3
const MAX_EASE = 2.8

/** Steps a well-recalled ayah climbs: 10m → 1h → 1d → 3d → 1w → 3w → 2mo. */
const LADDER_MIN = [10, 60, 1440, 4320, 10080, 30240, 86400]

function emptyStore(): HifdhStore {
  return { version: 1, ayahs: {}, days: [] }
}

function read(): HifdhStore {
  if (typeof window === 'undefined') return emptyStore()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<HifdhStore>
    return {
      version: 1,
      ayahs: parsed.ayahs && typeof parsed.ayahs === 'object' ? parsed.ayahs : {},
      days: Array.isArray(parsed.days) ? parsed.days.filter((d) => typeof d === 'string') : [],
    }
  } catch {
    return emptyStore()
  }
}

function write(store: HifdhStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    /* storage full or blocked — practice still works, it just won't persist */
  }
}

function todayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10)
}

function nextInterval(memory: AyahMemory | undefined, grade: Grade): number {
  if (grade === 'missed') return LADDER_MIN[0]
  if (grade === 'shaky') {
    // Hold roughly where it is; never let a shaky recall promote the ayah.
    return Math.max(LADDER_MIN[0], Math.round((memory?.intervalMin ?? LADDER_MIN[0]) * 0.6))
  }
  const streak = (memory?.streak ?? 0) + 1
  const step = LADDER_MIN[Math.min(streak, LADDER_MIN.length - 1)]
  return Math.round(step * (memory?.ease ?? 2.2) * 0.45)
}

export function getMemory(verseKey: string): AyahMemory | undefined {
  return read().ayahs[verseKey]
}

export function getAllMemory(): Record<string, AyahMemory> {
  return read().ayahs
}

export function recordGrade(verseKey: string, grade: Grade, now = Date.now()): AyahMemory {
  const store = read()
  const prev = store.ayahs[verseKey]

  const easeShift = grade === 'got' ? 0.1 : grade === 'shaky' ? -0.15 : -0.2
  const ease = Math.min(MAX_EASE, Math.max(MIN_EASE, (prev?.ease ?? 2.2) + easeShift))
  const intervalMin = nextInterval(prev, grade)

  const next: AyahMemory = {
    verseKey,
    ease,
    intervalMin,
    dueAt: now + intervalMin * MINUTE,
    streak: grade === 'got' ? (prev?.streak ?? 0) + 1 : 0,
    attempts: (prev?.attempts ?? 0) + 1,
    misses: (prev?.misses ?? 0) + (grade === 'missed' ? 1 : 0),
    lastGrade: grade,
    lastSeenAt: now,
  }

  store.ayahs[verseKey] = next
  const day = todayKey(now)
  if (!store.days.includes(day)) store.days.push(day)
  write(store)
  return next
}

/** Ayahs missed most often — the practice list that actually matters. */
export function getWeakVerseKeys(limit = 30): string[] {
  const all = Object.values(read().ayahs)
  return all
    .filter((m) => m.misses > 0 || m.lastGrade !== 'got')
    .sort((a, b) => {
      const aRate = a.misses / Math.max(1, a.attempts)
      const bRate = b.misses / Math.max(1, b.attempts)
      if (bRate !== aRate) return bRate - aRate
      return b.lastSeenAt - a.lastSeenAt
    })
    .slice(0, limit)
    .map((m) => m.verseKey)
}

export interface SessionPickOptions {
  /** Every verse key that the chosen scope allows. */
  candidates: string[]
  size: number
  now?: number
}

/**
 * Build a session: anything already due comes first (weakest first), then
 * ayahs never seen, then a random fill. Keeps revision honest without ever
 * showing the same ayah twice in one run.
 */
export function pickSessionVerses({ candidates, size, now = Date.now() }: SessionPickOptions): string[] {
  const memory = read().ayahs
  const pool = new Set(candidates)
  const picked: string[] = []

  const due = candidates
    .filter((key) => memory[key] && memory[key].dueAt <= now)
    .sort((a, b) => {
      const aRate = memory[a].misses / Math.max(1, memory[a].attempts)
      const bRate = memory[b].misses / Math.max(1, memory[b].attempts)
      if (bRate !== aRate) return bRate - aRate
      return memory[a].dueAt - memory[b].dueAt
    })

  for (const key of due) {
    if (picked.length >= size) break
    picked.push(key)
    pool.delete(key)
  }

  const unseen = [...pool].filter((key) => !memory[key])
  while (picked.length < size && unseen.length > 0) {
    const idx = Math.floor(Math.random() * unseen.length)
    const [key] = unseen.splice(idx, 1)
    picked.push(key)
    pool.delete(key)
  }

  const rest = [...pool]
  while (picked.length < size && rest.length > 0) {
    const idx = Math.floor(Math.random() * rest.length)
    const [key] = rest.splice(idx, 1)
    picked.push(key)
  }

  return picked
}

export interface HifdhStats {
  tracked: number
  attempts: number
  accuracy: number
  strong: number
  weak: number
  dueNow: number
  dayStreak: number
}

export function getStats(now = Date.now()): HifdhStats {
  const store = read()
  const all = Object.values(store.ayahs)
  const attempts = all.reduce((sum, m) => sum + m.attempts, 0)
  const misses = all.reduce((sum, m) => sum + m.misses, 0)

  return {
    tracked: all.length,
    attempts,
    accuracy: attempts > 0 ? Math.round(((attempts - misses) / attempts) * 100) : 0,
    strong: all.filter((m) => m.streak >= 2).length,
    weak: all.filter((m) => m.lastGrade !== 'got').length,
    dueNow: all.filter((m) => m.dueAt <= now).length,
    dayStreak: dayStreak(store.days, now),
  }
}

/** Consecutive days ending today (or yesterday, so an in-progress day counts). */
function dayStreak(days: string[], now: number): number {
  if (days.length === 0) return 0
  const set = new Set(days)
  let streak = 0
  const cursor = new Date(now)

  if (!set.has(todayKey(now))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!set.has(cursor.toISOString().slice(0, 10))) return 0
  }

  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (!set.has(key)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function resetHifdhProgress(): void {
  write(emptyStore())
}

export const HIFDH_PROGRESS_EVENT = EVENT_NAME
