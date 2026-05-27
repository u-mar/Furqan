import type { Verse } from '@/types'

export interface VerseArabicTextOptions {
  /** Omit ayah end marker (۝ and verse number) from display text. */
  omitEndMark?: boolean
}

/** Plain Uthmani text for UI (action sheet, translation headers). Never uses QCF glyph codes. */
export function getVerseArabicText(verse: Verse, options?: VerseArabicTextOptions): string {
  const omitEndMark = options?.omitEndMark ?? false

  if (!omitEndMark) {
    const fromVerse = verse.text_uthmani?.replace(/\s+/g, ' ').trim()
    if (fromVerse) return fromVerse
  }

  if (!verse.words?.length) {
    const fallback = verse.text_uthmani?.replace(/\s+/g, ' ').trim() ?? ''
    return omitEndMark ? stripAyahEndFromPlainText(fallback) : fallback
  }

  const parts: string[] = []
  for (const word of verse.words) {
    if (word.char_type_name === 'end') {
      if (omitEndMark) continue
      const endText = (word.text_uthmani || word.text_qpc_hafs || '').trim()
      if (endText) parts.push(endText)
      continue
    }
    if (word.char_type_name !== 'word') continue
    const text = (word.text_uthmani || word.text_qpc_hafs || '').trim()
    if (text) parts.push(text)
  }

  return parts.join(' ').trim()
}

/** Remove trailing ayah reference from labels like "Al-Baqarah, 2:152". */
export function stripAyahRefFromLabel(label: string): string {
  return label
    .replace(/,?\s*\d+\s*:\s*\d+\s*$/u, '')
    .replace(/\s*·\s*ayah\s*\d+\s*$/iu, '')
    .trim()
}

function stripAyahEndFromPlainText(text: string): string {
  return text
    .replace(/[\u06DD\u06DE\u06DF]?\s*[\u0660-\u0669\u06F0-\u06F9]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}
