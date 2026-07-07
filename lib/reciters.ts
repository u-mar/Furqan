export type RecitationSource = 'everyayah' | 'mp3quran'

export interface Reciter {
  id: string
  name: string
  source: RecitationSource
  /** EveryAyah folder name, or mp3quran server base URL (no trailing slash). */
  folder: string
  /** Full-surah MP3 base URL on mp3quran.net (used by Listen). */
  mp3quranBase: string
}

export const RECITERS: Reciter[] = [
  {
    id: 'alafasy',
    name: 'Mishary Alafasy',
    source: 'everyayah',
    folder: 'Alafasy_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/afs',
  },
  {
    id: 'husary',
    name: 'Mahmoud Al-Husary',
    source: 'everyayah',
    folder: 'Husary_128kbps',
    mp3quranBase: 'https://server13.mp3quran.net/husr',
  },
  {
    id: 'minshawi',
    name: 'Mohamed Siddiq Al-Minshawi',
    source: 'everyayah',
    folder: 'Minshawy_Murattal_128kbps',
    mp3quranBase: 'https://server10.mp3quran.net/minsh',
  },
  {
    id: 'abdulbasit',
    name: 'Abdul Basit Murattal',
    source: 'everyayah',
    folder: 'Abdul_Basit_Murattal_192kbps',
    mp3quranBase: 'https://server7.mp3quran.net/basit',
  },
  {
    id: 'sudais',
    name: 'Abdur-Rahman As-Sudais',
    source: 'everyayah',
    folder: 'Abdurrahmaan_As-Sudais_192kbps',
    mp3quranBase: 'https://server11.mp3quran.net/sds',
  },
  {
    id: 'maher',
    name: 'Maher Al-Muaiqly',
    source: 'everyayah',
    folder: 'MaherAlMuaiqly128kbps',
    mp3quranBase: 'https://server12.mp3quran.net/maher',
  },
  {
    id: 'ghamadi',
    name: 'Saad Al-Ghamdi',
    source: 'everyayah',
    folder: 'Ghamadi_40kbps',
    mp3quranBase: 'https://server7.mp3quran.net/s_gmd',
  },
  {
    id: 'shatri',
    name: 'Abu Bakr Al-Shatri',
    source: 'everyayah',
    folder: 'Abu_Bakr_Ash-Shaatree_128kbps',
    mp3quranBase: 'https://server11.mp3quran.net/shatri',
  },
  {
    id: 'qatami',
    name: 'Nasser Al-Qatami',
    source: 'everyayah',
    folder: 'Nasser_Alqatami_128kbps',
    mp3quranBase: 'https://server6.mp3quran.net/qtm',
  },
  {
    id: 'mrifai',
    name: 'Mahmood Al-Rifai',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/mrifai',
    mp3quranBase: 'https://server11.mp3quran.net/mrifai',
  },
  {
    id: 'a_ahmed',
    name: 'Abdul Aziz Al-Ahmad',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/a_ahmed',
    mp3quranBase: 'https://server11.mp3quran.net/a_ahmed',
  },
  {
    id: 'soufi',
    name: 'Abdul Rashid Sufi',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/soufi/Rewayat-Hafs-A-n-Assem',
    mp3quranBase: 'https://server16.mp3quran.net/soufi/Rewayat-Hafs-A-n-Assem',
  },
  {
    id: 'nourin_siddig',
    name: 'Noreen Mohammad Siddiq',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/nourin_siddig/Rewayat-Aldori-A-n-Abi-Amr',
    mp3quranBase: 'https://server16.mp3quran.net/nourin_siddig/Rewayat-Aldori-A-n-Abi-Amr',
  },
]

export const DEFAULT_RECITER_ID = 'alafasy'

export function getReciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]
}

export function isSurahOnlyReciter(reciter: Reciter): boolean {
  return reciter.source === 'mp3quran'
}

export function everyAyahAudioUrl(reciterFolder: string, surah: number, ayah: number): string {
  const surahPadded = String(surah).padStart(3, '0')
  const ayahPadded = String(ayah).padStart(3, '0')
  return `https://everyayah.com/data/${reciterFolder}/${surahPadded}${ayahPadded}.mp3`
}

export function mp3quranSurahUrl(serverBase: string, surah: number): string {
  const surahPadded = String(surah).padStart(3, '0')
  const base = serverBase.replace(/\/$/, '')
  return `${base}/${surahPadded}.mp3`
}

/** Full-surah URL for Listen (always mp3quran). */
export function listenSurahAudioUrl(reciter: Reciter, surah: number): string {
  return mp3quranSurahUrl(reciter.mp3quranBase, surah)
}

export function ayahAudioUrl(reciter: Reciter, surah: number, ayah: number): string {
  if (reciter.source === 'mp3quran') {
    return mp3quranSurahUrl(reciter.folder, surah)
  }
  return everyAyahAudioUrl(resolveReciterFolder(reciter.folder), surah, ayah)
}

export function surahAudioUrl(reciter: Reciter, surah: number): string {
  if (reciter.source === 'mp3quran') {
    return mp3quranSurahUrl(reciter.folder, surah)
  }
  return everyAyahAudioUrl(resolveReciterFolder(reciter.folder), surah, 1)
}

/** Legacy folder names saved in settings or offline cache — map to current EveryAyah paths. */
const LEGACY_RECITER_FOLDERS: Record<string, string> = {
  Sudais_128kbps: 'Abdurrahmaan_As-Sudais_192kbps',
}

export function resolveReciterFolder(folder: string): string {
  return LEGACY_RECITER_FOLDERS[folder] ?? folder
}

export const SURAH_ONLY_RECITER_HINT =
  'This reciter streams full surahs from MP3Quran. Ayah-by-ayah mode works best with other reciters.'
