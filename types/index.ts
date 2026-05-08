export interface Session {
  id: string
  verseKey: string
  surahName: string
  score: number
  canonical: string
  transcript: string
  timestamp: number
}

export type SessionStore = Session[]

export interface Chapter {
  id: number
  name: string
  name_simple?: string
  englishName: string
  versesCount: number
}

export interface Verse {
  id: number
  verse_key: string
  text_uthmani: string
  verse_number?: number
  juz_number?: number
  page_number?: number
  words?: VerseWord[]
}

export interface VerseWord {
  id: number
  verse_key: string
  position: number
  text_uthmani: string
  text_qpc_hafs?: string
  code_v2?: string
  line_number?: number
  page_number?: number
  v2_page?: number
  char_type_name?: 'word' | 'end' | string
}

export type ScopeMode = 'surah' | 'juz' | 'range'

export type DiffStatus = 'correct' | 'wrong' | 'missed' | 'extra'

export type Op = 'match' | 'substitution' | 'deletion' | 'insertion'

export interface WordResult {
  canonical: string
  hypothesis: string
  op: Op
}
