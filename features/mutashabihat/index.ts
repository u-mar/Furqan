import type { Verse } from '@/types'

export interface MutashabihatFeature {
  isEnabled(): boolean
  getSimilarVerses(verse: Verse): MutashabihVerse[]
  checkAnswer(userAnswer: string, correctAnswer: string): MutashabihResult
}

export interface MutashabihVerse {
  verseKey: string
  similarity: number
  surahName: string
  ayahNumber: number
  textSnippet: string
}

export interface MutashabihResult {
  isCorrect: boolean
  matchedVerse?: MutashabihVerse
}

export const mutashabihatFeature: MutashabihatFeature = {
  isEnabled: () => false,
  getSimilarVerses() {
    return []
  },
  checkAnswer() {
    throw new Error('Mutashabihat feature not configured')
  },
}