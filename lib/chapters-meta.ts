import type { Verse } from '@/types'
import { getChapters, loadQuranData } from '@/lib/quran'

export interface ChapterMeta {
  id: number
  name_simple: string
  name_arabic: string
  verses_count: number
  pages: [number, number]
  revelation_place: string
}

let cached: ChapterMeta[] | null = null

function pageFromVerse(verse: Verse): number {
  const first = verse.words?.[0]
  return first?.v2_page || first?.page_number || verse.page_number || 1
}

async function buildMetaFromVerses(): Promise<ChapterMeta[]> {
  const { verses } = await loadQuranData()
  const chapters = await getChapters()
  const ranges = new Map<number, { min: number; max: number; count: number }>()

  for (const verse of verses) {
    const id = Number(verse.verse_key.split(':')[0])
    if (!id) continue
    const page = pageFromVerse(verse)
    const row = ranges.get(id) || { min: page, max: page, count: 0 }
    row.min = Math.min(row.min, page)
    row.max = Math.max(row.max, page)
    row.count += 1
    ranges.set(id, row)
  }

  return chapters.map((ch) => {
    const row = ranges.get(ch.id)
    const pages: [number, number] = row ? [row.min, row.max] : [1, 1]
    return {
      id: ch.id,
      name_simple: ch.englishName,
      name_arabic: ch.name,
      verses_count: ch.versesCount || row?.count || 0,
      pages,
      revelation_place: 'unknown',
    }
  })
}

export async function getChaptersMeta(): Promise<ChapterMeta[]> {
  if (cached) return cached

  try {
    const res = await fetch('/quran-chapters.json', { cache: 'force-cache' })
    if (!res.ok) throw new Error('Failed to load chapters meta')
    const data = (await res.json()) as { chapters: ChapterMeta[] }
    cached = data.chapters
    return cached
  } catch {
    cached = await buildMetaFromVerses()
    return cached
  }
}

export function estimatePageForVerse(surah: number, ayah: number, meta: ChapterMeta[]): number {
  const ch = meta.find((c) => c.id === surah)
  if (!ch) return 1
  const [start, end] = ch.pages
  if (ch.verses_count <= 1) return start
  const ratio = (ayah - 1) / (ch.verses_count - 1)
  return Math.min(end, Math.max(start, Math.round(start + ratio * (end - start))))
}

export function chapterStartPage(chapterId: number, meta: ChapterMeta[]): number {
  const ch = meta.find((c) => c.id === chapterId)
  return ch?.pages[0] ?? 1
}
