export interface Reciter {
  id: string
  name: string
  /** EveryAyah CDN folder name */
  folder: string
}

export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'Mishary Alafasy', folder: 'Alafasy_128kbps' },
  { id: 'husary', name: 'Mahmoud Al-Husary', folder: 'Husary_128kbps' },
  { id: 'minshawi', name: 'Mohamed Siddiq Al-Minshawi', folder: 'Minshawy_Murattal_128kbps' },
  { id: 'abdulbasit', name: 'Abdul Basit Murattal', folder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'sudais', name: 'Abdur-Rahman As-Sudais', folder: 'Sudais_128kbps' },
  { id: 'ghamadi', name: 'Saad Al-Ghamdi', folder: 'Ghamadi_40kbps' },
]

export const DEFAULT_RECITER_ID = 'alafasy'

export function getReciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]
}

export function everyAyahAudioUrl(reciterFolder: string, surah: number, ayah: number): string {
  const surahPadded = String(surah).padStart(3, '0')
  const ayahPadded = String(ayah).padStart(3, '0')
  return `https://everyayah.com/data/${reciterFolder}/${surahPadded}${ayahPadded}.mp3`
}
