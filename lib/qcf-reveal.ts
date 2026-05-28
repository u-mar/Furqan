import type { QcfPageLine } from '@/lib/qcf-page'
import type { Verse } from '@/types'

export type QcfLineRevealState = 'hidden' | 'shown' | 'tap'

export function getQcfLineRevealState(
  line: QcfPageLine,
  options: {
    verses: Verse[]
    startIndex: number
    revealedAyahs: Set<string>
    revealableVerseKeys: Set<string>
    nextVerseKey: string | null
  }
): QcfLineRevealState {
  const { verses, startIndex, revealedAyahs, revealableVerseKeys, nextVerseKey } = options

  if (line.kind === 'empty') return 'hidden'

  const startSurah =
    startIndex >= 0 ? Number(verses[startIndex]?.verse_key.split(':')[0] || 0) : 0

  if (line.kind === 'surah-header' || line.kind === 'basmalah') {
    if (startIndex >= 0 && line.chapterNumber && line.chapterNumber < startSurah) {
      return 'hidden'
    }
    if (startIndex >= 0 && line.chapterNumber === startSurah) {
      const startAyah = Number(verses[startIndex]?.verse_key.split(':')[1] || 1)
      if (startAyah > 1) return 'hidden'
    }
    return 'shown'
  }

  if (line.verseKeys.length === 0) return 'hidden'

  const verseIndexByKey = new Map<string, number>()
  verses.forEach((verse, index) => verseIndexByKey.set(verse.verse_key, index))

  const indices = line.verseKeys
    .map((key) => verseIndexByKey.get(key))
    .filter((index): index is number => index !== undefined)

  if (startIndex >= 0 && indices.length > 0 && indices.every((index) => index < startIndex)) {
    return 'hidden'
  }

  if (line.verseKeys.some((key) => revealedAyahs.has(key))) {
    return 'shown'
  }

  if (
    nextVerseKey &&
    line.verseKeys.includes(nextVerseKey) &&
    revealableVerseKeys.has(nextVerseKey)
  ) {
    return 'tap'
  }

  return 'hidden'
}
