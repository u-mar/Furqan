export type RecitationSource = 'everyayah' | 'mp3quran'

/** The ten canonical narrations (riwayat) available from MP3Quran. */
export type QiraatId =
  | 'hafs'
  | 'shubah'
  | 'warsh'
  | 'qalon'
  | 'duri_abi_amr'
  | 'susi'
  | 'bizzi'
  | 'qunbul'
  | 'ibn_dhakwan'
  | 'khalaf'
  | 'duri_kisai'
  | 'rowis_rawh'

export interface QiraatInfo {
  id: QiraatId
  /** Full narration name, e.g. "Hafs 'an 'Asim". */
  label: string
  /** Compact chip label. */
  short: string
}

export const QIRAAT: QiraatInfo[] = [
  { id: 'hafs', label: "Hafs 'an 'Asim", short: 'Hafs' },
  { id: 'shubah', label: "Shu'bah 'an 'Asim", short: "Shu'bah" },
  { id: 'warsh', label: "Warsh 'an Nafi'", short: 'Warsh' },
  { id: 'qalon', label: "Qalun 'an Nafi'", short: 'Qalun' },
  { id: 'duri_abi_amr', label: "Al-Duri 'an Abu 'Amr", short: 'Al-Duri' },
  { id: 'susi', label: "Al-Susi 'an Abu 'Amr", short: 'Al-Susi' },
  { id: 'bizzi', label: "Al-Bizzi 'an Ibn Kathir", short: 'Al-Bizzi' },
  { id: 'qunbul', label: "Qunbul 'an Ibn Kathir", short: 'Qunbul' },
  { id: 'ibn_dhakwan', label: "Ibn Dhakwan 'an Ibn 'Amir", short: 'Ibn Dhakwan' },
  { id: 'khalaf', label: "Khalaf 'an Hamzah", short: 'Khalaf' },
  { id: 'duri_kisai', label: "Al-Duri 'an Al-Kisa'i", short: "Al-Kisa'i" },
  { id: 'rowis_rawh', label: "Ruways & Rawh 'an Ya'qub", short: "Ya'qub" },
]

export function getQiraat(id: QiraatId): QiraatInfo {
  return QIRAAT.find((q) => q.id === id) ?? QIRAAT[0]
}

export type RecitationStyle = 'Murattal' | 'Mujawwad' | "Mu'allim"

export interface Reciter {
  id: string
  name: string
  source: RecitationSource
  /** EveryAyah folder name, or mp3quran server base URL (no trailing slash). */
  folder: string
  /** Full-surah MP3 base URL on mp3quran.net (used by Listen). */
  mp3quranBase: string
  /** Narration this recitation follows. */
  qiraat: QiraatId
  /** Recitation pace/style. */
  style: RecitationStyle
  /** Two-stop gradient for the reciter avatar. */
  accent: [string, string]
}

/** A calm, varied palette so each reciter card is distinguishable. */
const A = {
  gold: ['#f0c877', '#d29a3c'] as [string, string],
  violet: ['#8163ef', '#4b39a2'] as [string, string],
  teal: ['#47c6d4', '#2a8fa0'] as [string, string],
  emerald: ['#63d1a8', '#2f9e75'] as [string, string],
  rose: ['#f27ba4', '#c9527e'] as [string, string],
  amber: ['#f5b263', '#d1802c'] as [string, string],
  indigo: ['#7d8cf0', '#4756c4'] as [string, string],
  sky: ['#6bb8f5', '#2f7fc4'] as [string, string],
  plum: ['#c07be0', '#8b45ad'] as [string, string],
  sand: ['#d9c08a', '#b0914f'] as [string, string],
}

export const RECITERS: Reciter[] = [
  // ---- Ayah-by-ayah capable (EveryAyah) — usable in Read, Imitate and Listen ----
  {
    id: 'alafasy',
    name: 'Mishary Alafasy',
    source: 'everyayah',
    folder: 'Alafasy_128kbps',
    mp3quranBase: 'https://server8.mp3quran.net/afs',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'husary',
    name: 'Mahmoud Al-Husary',
    source: 'everyayah',
    folder: 'Husary_128kbps',
    mp3quranBase: 'https://server13.mp3quran.net/husr',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'minshawi',
    name: 'Mohamed Siddiq Al-Minshawi',
    source: 'everyayah',
    folder: 'Minshawy_Murattal_128kbps',
    mp3quranBase: 'https://server10.mp3quran.net/minsh',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.teal,
  },
  {
    id: 'abdulbasit',
    name: 'Abdul Basit Abdul Samad',
    source: 'everyayah',
    folder: 'Abdul_Basit_Murattal_192kbps',
    mp3quranBase: 'https://server7.mp3quran.net/basit',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.violet,
  },
  {
    id: 'sudais',
    name: 'Abdur-Rahman As-Sudais',
    source: 'everyayah',
    folder: 'Abdurrahmaan_As-Sudais_192kbps',
    mp3quranBase: 'https://server11.mp3quran.net/sds',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'maher',
    name: 'Maher Al-Muaiqly',
    source: 'everyayah',
    folder: 'MaherAlMuaiqly128kbps',
    mp3quranBase: 'https://server12.mp3quran.net/maher',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'ghamadi',
    name: 'Saad Al-Ghamdi',
    source: 'everyayah',
    folder: 'Ghamadi_40kbps',
    mp3quranBase: 'https://server7.mp3quran.net/s_gmd',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'shatri',
    name: 'Abu Bakr Al-Shatri',
    source: 'everyayah',
    folder: 'Abu_Bakr_Ash-Shaatree_128kbps',
    mp3quranBase: 'https://server11.mp3quran.net/shatri',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.amber,
  },
  {
    id: 'qatami',
    name: 'Nasser Al-Qatami',
    source: 'everyayah',
    folder: 'Nasser_Alqatami_128kbps',
    mp3quranBase: 'https://server6.mp3quran.net/qtm',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.plum,
  },

  // ---- Full-surah only (MP3Quran) — Hafs 'an 'Asim ----
  {
    id: 'shuraim',
    name: 'Saud Al-Shuraim',
    source: 'mp3quran',
    folder: 'https://server7.mp3quran.net/shur',
    mp3quranBase: 'https://server7.mp3quran.net/shur',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'ajmi',
    name: 'Ahmad Al-Ajmi',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/ajm',
    mp3quranBase: 'https://server10.mp3quran.net/ajm',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'johany',
    name: 'Abdullah Al-Johany',
    source: 'mp3quran',
    folder: 'https://server13.mp3quran.net/jhn',
    mp3quranBase: 'https://server13.mp3quran.net/jhn',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'balilah',
    name: 'Bandar Balilah',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/balilah',
    mp3quranBase: 'https://server6.mp3quran.net/balilah',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'yasser_dosari',
    name: 'Yasser Al-Dosari',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/yasser',
    mp3quranBase: 'https://server11.mp3quran.net/yasser',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.violet,
  },
  {
    id: 'hani',
    name: 'Hani Ar-Rifai',
    source: 'mp3quran',
    folder: 'https://server8.mp3quran.net/hani',
    mp3quranBase: 'https://server8.mp3quran.net/hani',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.teal,
  },
  {
    id: 'bukhatir',
    name: 'Salah Bukhatir',
    source: 'mp3quran',
    folder: 'https://server8.mp3quran.net/bu_khtr',
    mp3quranBase: 'https://server8.mp3quran.net/bu_khtr',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sand,
  },
  {
    id: 'twfeeq',
    name: 'Tawfeeq As-Sayegh',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/twfeeq',
    mp3quranBase: 'https://server6.mp3quran.net/twfeeq',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'ayyub',
    name: 'Mohammed Ayyub',
    source: 'mp3quran',
    folder: 'https://server8.mp3quran.net/ayyub',
    mp3quranBase: 'https://server8.mp3quran.net/ayyub',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.amber,
  },
  {
    id: 'banna',
    name: 'Mahmoud Ali Al-Banna',
    source: 'mp3quran',
    folder: 'https://server8.mp3quran.net/bna',
    mp3quranBase: 'https://server8.mp3quran.net/bna',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'akdar',
    name: 'Ibrahim Al-Akdar',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/akdr',
    mp3quranBase: 'https://server6.mp3quran.net/akdr',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sand,
  },
  {
    id: 'qahtani',
    name: 'Khaled Al-Qahtani',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/qht',
    mp3quranBase: 'https://server10.mp3quran.net/qht',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'huthaifi',
    name: 'Ali Al-Huthaifi',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/hthfi',
    mp3quranBase: 'https://server9.mp3quran.net/hthfi',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'aloosi',
    name: 'Abdulrahman Al-Aloosi',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/aloosi',
    mp3quranBase: 'https://server6.mp3quran.net/aloosi',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.teal,
  },
  {
    id: 'budair',
    name: 'Salah Al-Budair',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/s_bud',
    mp3quranBase: 'https://server6.mp3quran.net/s_bud',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'mrifai',
    name: 'Mahmood Al-Rifai',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/mrifai',
    mp3quranBase: 'https://server11.mp3quran.net/mrifai',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'a_ahmed',
    name: 'Abdul Aziz Al-Ahmad',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/a_ahmed',
    mp3quranBase: 'https://server11.mp3quran.net/a_ahmed',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.violet,
  },
  {
    id: 'soufi',
    name: 'Abdul Rashid Sufi',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/soufi/Rewayat-Hafs-A-n-Assem',
    mp3quranBase: 'https://server16.mp3quran.net/soufi/Rewayat-Hafs-A-n-Assem',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.rose,
  },

  // ---- Mujawwad / Mu'allim ----
  {
    id: 'minshawi_mujawwad',
    name: 'Mohamed Siddiq Al-Minshawi',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/minsh/Almusshaf-Al-Mojawwad',
    mp3quranBase: 'https://server10.mp3quran.net/minsh/Almusshaf-Al-Mojawwad',
    qiraat: 'hafs',
    style: 'Mujawwad',
    accent: A.teal,
  },
  {
    id: 'maher_mujawwad',
    name: 'Maher Al-Muaiqly',
    source: 'mp3quran',
    folder: 'https://server12.mp3quran.net/maher/Almusshaf-Al-Mojawwad',
    mp3quranBase: 'https://server12.mp3quran.net/maher/Almusshaf-Al-Mojawwad',
    qiraat: 'hafs',
    style: 'Mujawwad',
    accent: A.sky,
  },
  {
    id: 'tablawi_mujawwad',
    name: 'Mohammad Al-Tablawi',
    source: 'mp3quran',
    folder: 'https://server12.mp3quran.net/tblawi/Al-Mojawwad',
    mp3quranBase: 'https://server12.mp3quran.net/tblawi/Al-Mojawwad',
    qiraat: 'hafs',
    style: 'Mujawwad',
    accent: A.amber,
  },
  {
    id: 'minshawi_moalim',
    name: 'Mohamed Siddiq Al-Minshawi',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/minsh/Almusshaf-Al-Mo-lim',
    mp3quranBase: 'https://server10.mp3quran.net/minsh/Almusshaf-Al-Mo-lim',
    qiraat: 'hafs',
    style: "Mu'allim",
    accent: A.emerald,
  },

  // ---- Other qira'at (narrations) ----
  {
    id: 'husary_warsh',
    name: 'Mahmoud Al-Husary',
    source: 'mp3quran',
    folder: 'https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi',
    mp3quranBase: 'https://server13.mp3quran.net/husr/Rewayat-Warsh-A-n-Nafi',
    qiraat: 'warsh',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'husary_qalon',
    name: 'Mahmoud Al-Husary',
    source: 'mp3quran',
    folder: 'https://server13.mp3quran.net/husr/Rewayat-Qalon-A-n-Nafi',
    mp3quranBase: 'https://server13.mp3quran.net/husr/Rewayat-Qalon-A-n-Nafi',
    qiraat: 'qalon',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'husary_duri',
    name: 'Mahmoud Al-Husary',
    source: 'mp3quran',
    folder: 'https://server13.mp3quran.net/husr/Rewayat-Aldori-A-n-Abi-Amr',
    mp3quranBase: 'https://server13.mp3quran.net/husr/Rewayat-Aldori-A-n-Abi-Amr',
    qiraat: 'duri_abi_amr',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'nourin_siddig',
    name: 'Noreen Mohammad Siddiq',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/nourin_siddig/Rewayat-Aldori-A-n-Abi-Amr',
    mp3quranBase: 'https://server16.mp3quran.net/nourin_siddig/Rewayat-Aldori-A-n-Abi-Amr',
    qiraat: 'duri_abi_amr',
    style: 'Murattal',
    accent: A.sand,
  },
  {
    id: 'soufi_susi',
    name: 'Abdul Rashid Sufi',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/soufi/Rewayat-Assosi-A-n-Abi-Amr',
    mp3quranBase: 'https://server16.mp3quran.net/soufi/Rewayat-Assosi-A-n-Abi-Amr',
    qiraat: 'susi',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'soufi_khalaf',
    name: 'Abdul Rashid Sufi',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/soufi/Rewayat-Khalaf-A-n-Hamzah',
    mp3quranBase: 'https://server16.mp3quran.net/soufi/Rewayat-Khalaf-A-n-Hamzah',
    qiraat: 'khalaf',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'deban_shubah',
    name: 'Ahmad Deban',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/deban/Rewayat-Sho-bah-A-n-Asim',
    mp3quranBase: 'https://server16.mp3quran.net/deban/Rewayat-Sho-bah-A-n-Asim',
    qiraat: 'shubah',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'deban_bizzi',
    name: 'Ahmad Deban',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/deban/Rewayat-Albizi-A-n-Ibn-Katheer',
    mp3quranBase: 'https://server16.mp3quran.net/deban/Rewayat-Albizi-A-n-Ibn-Katheer',
    qiraat: 'bizzi',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'deban_qunbul',
    name: 'Ahmad Deban',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/deban/Rewayat-Qunbol-A-n-Ibn-Katheer',
    mp3quranBase: 'https://server16.mp3quran.net/deban/Rewayat-Qunbol-A-n-Ibn-Katheer',
    qiraat: 'qunbul',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'deban_warsh_azraq',
    name: 'Ahmad Deban',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/deban/Rewayat-Warsh-A-n-Nafi-Men-Tariq-Alazraq',
    mp3quranBase: 'https://server16.mp3quran.net/deban/Rewayat-Warsh-A-n-Nafi-Men-Tariq-Alazraq',
    qiraat: 'warsh',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'saltany_ibn_dhakwan',
    name: 'Muftah As-Saltany',
    source: 'mp3quran',
    folder: 'https://server14.mp3quran.net/muftah_sultany/Rewayat_Ibn-Thakwan-A-n-Ibn-Amer',
    mp3quranBase: 'https://server14.mp3quran.net/muftah_sultany/Rewayat_Ibn-Thakwan-A-n-Ibn-Amer',
    qiraat: 'ibn_dhakwan',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'abdullah_kisai',
    name: 'Mohammad Al-Abdullah',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/abdullah/Rewayat-AlDorai-A-n-Al-Kisa-ai',
    mp3quranBase: 'https://server9.mp3quran.net/abdullah/Rewayat-AlDorai-A-n-Al-Kisa-ai',
    qiraat: 'duri_kisai',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'mazroyee_rowis',
    name: 'Yasser Al-Mazroyee',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/mzroyee',
    mp3quranBase: 'https://server9.mp3quran.net/mzroyee',
    qiraat: 'rowis_rawh',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'qari_warsh',
    name: 'Al-Qaria Yassen',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/qari',
    mp3quranBase: 'https://server11.mp3quran.net/qari',
    qiraat: 'warsh',
    style: 'Murattal',
    accent: A.amber,
  },
  {
    id: 'trablsi_qalon',
    name: 'Ahmed At-Trabulsi',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/trablsi',
    mp3quranBase: 'https://server10.mp3quran.net/trablsi',
    qiraat: 'qalon',
    style: 'Murattal',
    accent: A.teal,
  },
]

export const DEFAULT_RECITER_ID = 'alafasy'

export function getReciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]
}

export function isSurahOnlyReciter(reciter: Reciter): boolean {
  return reciter.source === 'mp3quran'
}

/** Reciters that support ayah-by-ayah audio (Read highlighting, Imitate). */
export function ayahCapableReciters(): Reciter[] {
  return RECITERS.filter((r) => !isSurahOnlyReciter(r))
}

/** Narrations that actually have at least one reciter. */
export function availableQiraat(): QiraatInfo[] {
  const present = new Set(RECITERS.map((r) => r.qiraat))
  return QIRAAT.filter((q) => present.has(q.id))
}

/** Initials for the reciter avatar. */
export function reciterInitials(name: string): string {
  const parts = name.replace(/^(Al|Ash|As|Ar|Abu)\s+/i, '').trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
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
