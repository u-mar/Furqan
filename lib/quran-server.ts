import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Verse } from '@/types'

interface QuranData {
  verses: Verse[]
}

let cachedVerses: Verse[] | null = null

async function loadVerses(): Promise<Verse[]> {
  if (cachedVerses) return cachedVerses
  const filePath = path.join(process.cwd(), 'public', 'quran-data.json')
  const raw = await readFile(filePath, 'utf-8')
  const data = JSON.parse(raw) as QuranData
  cachedVerses = data.verses
  return cachedVerses
}

export async function getVersesByPageServer(pageNumber: number): Promise<Verse[]> {
  const verses = await loadVerses()
  return verses.filter((v) => v.page_number === pageNumber)
}

function translationFromWords(verse: Verse): string {
  if (!verse.words?.length) return ''
  return verse.words
    .filter((w) => w.char_type_name === 'word' && w.translation?.text)
    .map((w) => w.translation!.text.trim())
    .join(' ')
}

export async function getTranslationsByPageServer(
  pageNumber: number
): Promise<Array<{ verse_key: string; text_uthmani: string; translation: string }>> {
  const verses = await getVersesByPageServer(pageNumber)
  return verses.map((v) => ({
    verse_key: v.verse_key,
    text_uthmani: v.text_uthmani,
    translation: translationFromWords(v),
  }))
}
