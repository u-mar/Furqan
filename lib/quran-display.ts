import type { Verse } from '@/types'

/** Plain Uthmani text for UI (action sheet, translation headers). Never uses QCF glyph codes. */
export function getVerseArabicText(verse: Verse): string {
  const fromVerse = verse.text_uthmani?.replace(/\s+/g, ' ').trim()
  if (fromVerse) return fromVerse

  if (!verse.words?.length) return ''

  const parts: string[] = []
  for (const word of verse.words) {
    if (word.char_type_name === 'end') {
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
