import type { Verse } from '@/types'

export interface RecitationFeature {
  isEnabled(): boolean
  startListening(verse: Verse): Promise<void>
  stopListening(): Promise<void>
  isListening(): boolean
  onResult(callback: (transcript: string, isCorrect: boolean) => void): void
}

export interface RecitationResult {
  transcript: string
  isCorrect: boolean
  accuracy: number
}

export const recitationFeature: RecitationFeature = {
  isEnabled: () => false,
  async startListening() {
    throw new Error('Recitation feature not configured')
  },
  async stopListening() {},
  isListening: () => false,
  onResult() {},
}