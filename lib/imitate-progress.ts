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
}

const STORAGE_KEY = 'muyassar_imitate_progress'

function readAll(): PracticeRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PracticeRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(records: PracticeRecord[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function savePracticeRecord(record: Omit<PracticeRecord, 'practicedAt' | 'attempts'>): PracticeRecord {
  const records = readAll()
  const key = `${record.reciterId}:${record.surah}:${record.ayah}`
  const existing = records.find((r) => `${r.reciterId}:${r.surah}:${r.ayah}` === key)

  const next: PracticeRecord = {
    ...record,
    practicedAt: new Date().toISOString(),
    attempts: (existing?.attempts ?? 0) + 1,
  }

  const filtered = records.filter((r) => `${r.reciterId}:${r.surah}:${r.ayah}` !== key)
  filtered.unshift(next)
  writeAll(filtered.slice(0, 200))
  return next
}

export function getRecentPractice(limit = 10): PracticeRecord[] {
  return readAll().slice(0, limit)
}

export function getBestForAyah(reciterId: string, surah: number, ayah: number): PracticeRecord | null {
  return readAll().find((r) => r.reciterId === reciterId && r.surah === surah && r.ayah === ayah) ?? null
}
