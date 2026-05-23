export interface ChapterMeta {
  id: number
  name_simple: string
  name_arabic: string
  verses_count: number
  pages: [number, number]
  revelation_place: string
}

let cached: ChapterMeta[] | null = null

export async function getChaptersMeta(): Promise<ChapterMeta[]> {
  if (cached) return cached
  const res = await fetch('/quran-chapters.json')
  if (!res.ok) throw new Error('Failed to load chapters meta')
  const data = (await res.json()) as { chapters: ChapterMeta[] }
  cached = data.chapters
  return cached
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
