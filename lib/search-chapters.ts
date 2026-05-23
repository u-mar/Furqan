import type { Chapter } from '@/types'

function normaliseQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function filterChapters(chapters: Chapter[], query: string): Chapter[] {
  const q = normaliseQuery(query)
  if (!q) return chapters

  const asNumber = Number(q)
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= 114) {
    const byId = chapters.find((c) => c.id === asNumber)
    if (byId) return [byId]
  }

  return chapters.filter((chapter) => {
    const english = chapter.englishName.toLowerCase()
    const englishSpaced = english.replace(/-/g, ' ')
    const qSpaced = q.replace(/-/g, ' ')

    return (
      String(chapter.id) === q ||
      english.includes(q) ||
      englishSpaced.includes(qSpaced) ||
      chapter.name.includes(query.trim()) ||
      (chapter.name_simple?.includes(query.trim()) ?? false)
    )
  })
}
