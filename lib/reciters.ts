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
  /** Two-stop gradient for the reciter avatar (used as fallback + tint). */
  accent: [string, string]
  /** Portrait photo URL (way2quran.com), when we have one. */
  photoUrl?: string
  /** Well-known, mainstream reciter — shown under the "Top" filter. */
  top?: boolean
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/mishary-alafasy.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-khalil-al-hosary.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/muhammad-siddiq-al-minshawi.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abdul-basit-abdul-samad.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abdul-rahman-al-sudais.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/maher-almaikulai.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/saad-al-ghamdi.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abu-bakr-al-shatri.jpg',
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
    top: true,
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/saud-al-shuraim.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/ahmed-al-agamy.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abdullah-al-juhani.jpg',
    name: 'Abdullah Al Juhani',
    source: 'mp3quran',
    folder: 'https://server13.mp3quran.net/jhn',
    mp3quranBase: 'https://server13.mp3quran.net/jhn',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'balilah',
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/bandar-balila.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/yasser-al-dosary.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/hani-al-rifai.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/salah-boukhatir.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/tawfiq-al-sayegh.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/mohamed-ayoub.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-ali-al-banna.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/ibrahim-al-akhdar.jpeg',
    name: 'Ibrahim Al-Akhdar',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/akdr',
    mp3quranBase: 'https://server6.mp3quran.net/akdr',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sand,
  },
  {
    id: 'qahtani',
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/khalid-al-qahtani.jpg',
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
    top: true,
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abdul-rahman-al-awsi.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/salah-al-badir.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-al-rifai.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abdul-aziz-al-ahmad.jpg',
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
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/abdul-rashid-sufi.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/muhammad-siddiq-al-minshawi.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/maher-almaikulai.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/muhammad-siddiq-al-minshawi.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-khalil-al-hosary.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-khalil-al-hosary.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-khalil-al-hosary.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/noreen-muhammad-siddiq.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/abdul-rashid-sufi.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/abdul-rashid-sufi.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/ahmed-diban.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/ahmed-diban.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/ahmed-diban.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/ahmed-diban.jpg',
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
    photoUrl: 'https://media.way2quran.com/imgs/yassin-al-jazairi.jpeg',
    name: 'Yassin Al-Jazairi',
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

  // ---- More top reciters (way2quran.com photos + mp3quran audio) ----
  {
    id: 'mustafa_ismail',
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/mustafa-ismail.jpg',
    name: 'Mustafa Ismail',
    source: 'mp3quran',
    folder: 'https://server8.mp3quran.net/mustafa/',
    mp3quranBase: 'https://server8.mp3quran.net/mustafa/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'majed_zamil',
    photoUrl: 'https://media.way2quran.com/imgs/majed-al-zamil.jpg',
    name: 'Majed Al-Zamil',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/zaml/',
    mp3quranBase: 'https://server9.mp3quran.net/zaml/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.violet,
  },
  {
    id: 'maher_shakhashero',
    photoUrl: 'https://media.way2quran.com/imgs/maher-shakhashero.jpg',
    name: 'Maher Shakhashero',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/shaksh/',
    mp3quranBase: 'https://server10.mp3quran.net/shaksh/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.teal,
  },
  {
    id: 'jamal_shaker',
    name: 'Jamal Shaker Abdullah',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/jamal/',
    mp3quranBase: 'https://server6.mp3quran.net/jamal/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'abdullah_kandari',
    photoUrl: 'https://media.way2quran.com/imgs/abdullah-al-kandari.jpg',
    name: 'Abdullah Al-Kandari',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/Abdullahk/',
    mp3quranBase: 'https://server10.mp3quran.net/Abdullahk/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'ahmed_amer',
    photoUrl: 'https://media.way2quran.com/imgs/ahmed-amer.jpg',
    name: 'Ahmed Amer',
    source: 'mp3quran',
    folder: 'https://server10.mp3quran.net/Aamer/',
    mp3quranBase: 'https://server10.mp3quran.net/Aamer/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.amber,
  },
  {
    id: 'abdulbadi_ghailan',
    photoUrl: 'https://media.way2quran.com/imgs/abdulbadi-ghailan.jpg',
    name: 'Abdulbadi Ghailan',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/A-Ghailan/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/A-Ghailan/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'junaid_abdullah',
    name: 'Junaid Adam Abdullah',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/J-Abdullah/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/J-Abdullah/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'alijon_qori',
    name: 'Alijon Qori',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/Alijon/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/Alijon/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'asim_luhaidan',
    photoUrl: 'https://media.way2quran.com/imgs/asim-al-luhaidan.jpg',
    name: 'Asim Al-Luhaidan',
    source: 'mp3quran',
    folder: 'https://server7.mp3quran.net/asim/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server7.mp3quran.net/asim/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sand,
  },
  {
    id: 'raad_kurdi',
    photoUrl: 'https://media.way2quran.com/imgs/raad-al-kurdi.jpg',
    name: 'Raad Al-Kurdi',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/kurdi/',
    mp3quranBase: 'https://server6.mp3quran.net/kurdi/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'marwan_alakri',
    name: 'Marwan Alakri',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/m_akri/Rewayat-Qalon-A-n-Nafi/',
    mp3quranBase: 'https://server16.mp3quran.net/m_akri/Rewayat-Qalon-A-n-Nafi/',
    qiraat: 'qalon',
    style: 'Murattal',
    accent: A.violet,
  },
  {
    id: 'abdullah_khalaf',
    photoUrl: 'https://media.way2quran.com/imgs/abdullah-al-khalaf.jpg',
    name: 'Abdullah Al-Khalaf',
    source: 'mp3quran',
    folder: 'https://server14.mp3quran.net/khalf/',
    mp3quranBase: 'https://server14.mp3quran.net/khalf/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.teal,
  },
  {
    id: 'dawood_hamza',
    photoUrl: 'https://media.way2quran.com/imgs/dawood-hamza.jpg',
    name: 'Dawood Hamza',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/hamza/',
    mp3quranBase: 'https://server9.mp3quran.net/hamza/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'nasser_almajed',
    photoUrl: 'https://media.way2quran.com/imgs/nasser-almajed.jpg',
    name: 'Nasser Almajed',
    source: 'mp3quran',
    folder: 'https://server14.mp3quran.net/nasser_almajed/',
    mp3quranBase: 'https://server14.mp3quran.net/nasser_almajed/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'saad_almqren',
    photoUrl: 'https://media.way2quran.com/imgs/saad-almqren.jpg',
    name: 'Saad Almqren',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/saad/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/saad/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.amber,
  },
  {
    id: 'abdullah_kamel',
    photoUrl: 'https://media.way2quran.com/imgs/abdullah-kamel.jpg',
    name: 'Abdullah Kamel',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/kamel/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/kamel/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'okasha_kameny',
    photoUrl: 'https://media.way2quran.com/imgs/okasha-kameny.jpg',
    name: 'Okasha Kameny',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/okasha/Rewayat-Albizi-A-n-Ibn-Katheer/',
    mp3quranBase: 'https://server16.mp3quran.net/okasha/Rewayat-Albizi-A-n-Ibn-Katheer/',
    qiraat: 'bizzi',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'mahmoud_abdel_hakam',
    photoUrl: 'https://media.way2quran.com/imgs/mahmoud-abdel-hakam.jpg',
    name: 'Mahmoud Abdul Hakam',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/m_abdelhakam/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/m_abdelhakam/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'saleh_alquraishi',
    photoUrl: 'https://media.way2quran.com/imgs/saleh-alquraishi.jpg',
    name: 'Saleh Alquraishi',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/s_alquraishi/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/s_alquraishi/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sand,
  },
  {
    id: 'ibrahim_asiri',
    photoUrl: 'https://media.way2quran.com/imgs/ibrahim-al-asiri.jpg',
    name: 'Ibrahim Al-Asiri',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/3siri/',
    mp3quranBase: 'https://server6.mp3quran.net/3siri/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.gold,
  },
  {
    id: 'saleh_alshamrani',
    photoUrl: 'https://media.way2quran.com/imgs/saleh-alshamrani.jpg',
    name: 'Saleh Alshamrani',
    source: 'mp3quran',
    folder: 'https://server16.mp3quran.net/shamrani/Rewayat-Hafs-A-n-Assem/',
    mp3quranBase: 'https://server16.mp3quran.net/shamrani/Rewayat-Hafs-A-n-Assem/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.violet,
  },
  {
    id: 'sahl_yassin',
    photoUrl: 'https://media.way2quran.com/imgs/sahl-yassin.jpg',
    name: 'Sahl Yassin',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/shl/',
    mp3quranBase: 'https://server6.mp3quran.net/shl/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.teal,
  },
  {
    id: 'saleh_habdan',
    photoUrl: 'https://media.way2quran.com/imgs/saleh-al-habdan.jpg',
    name: 'Saleh Al-Habdan',
    source: 'mp3quran',
    folder: 'https://server6.mp3quran.net/habdan/',
    mp3quranBase: 'https://server6.mp3quran.net/habdan/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.emerald,
  },
  {
    id: 'abdullah_khayyat',
    photoUrl: 'https://media.way2quran.com/imgs/abdullah-al-khayyat.jpg',
    name: 'Abdullah Al-Khayyat',
    source: 'mp3quran',
    folder: 'https://server12.mp3quran.net/kyat/',
    mp3quranBase: 'https://server12.mp3quran.net/kyat/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.rose,
  },
  {
    id: 'ali_jaber',
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/ali-jaber.jpg',
    name: 'Ali Jaber',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/a_jbr/',
    mp3quranBase: 'https://server11.mp3quran.net/a_jbr/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.amber,
  },
  {
    id: 'omar_qazabri',
    photoUrl: 'https://media.way2quran.com/imgs/omar-al-qazabri.jpg',
    name: 'Omar Al-Qazabri',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/omar_warsh/',
    mp3quranBase: 'https://server9.mp3quran.net/omar_warsh/',
    qiraat: 'warsh',
    style: 'Murattal',
    accent: A.indigo,
  },
  {
    id: 'fares_abbad',
    top: true,
    photoUrl: 'https://media.way2quran.com/imgs/fares-abbad.jpg',
    name: 'Fares Abbad',
    source: 'mp3quran',
    folder: 'https://server8.mp3quran.net/frs_a/',
    mp3quranBase: 'https://server8.mp3quran.net/frs_a/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sky,
  },
  {
    id: 'yasser_qurashi',
    photoUrl: 'https://media.way2quran.com/imgs/yasser-al-qurashi.jpg',
    name: 'Yasser Al-Qurashi',
    source: 'mp3quran',
    folder: 'https://server9.mp3quran.net/qurashi/',
    mp3quranBase: 'https://server9.mp3quran.net/qurashi/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.plum,
  },
  {
    id: 'hazaa_balushi',
    photoUrl: 'https://media.way2quran.com/imgs/hazaa-al-balushi.jpg',
    name: 'Hazaa Al-Balushi',
    source: 'mp3quran',
    folder: 'https://server11.mp3quran.net/hazza/',
    mp3quranBase: 'https://server11.mp3quran.net/hazza/',
    qiraat: 'hafs',
    style: 'Murattal',
    accent: A.sand,
  },
]

export const DEFAULT_RECITER_ID = 'alafasy'

export function getReciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0]
}

/**
 * All recorded narrations/styles for the same person as `reciter` (matched by
 * exact display name), sorted with Hafs first. Includes `reciter` itself.
 */
export function getReciterVariants(reciter: Reciter): Reciter[] {
  const variants = RECITERS.filter((r) => r.name === reciter.name)
  return variants.sort((a, b) => {
    if (a.qiraat === b.qiraat) return a.style === b.style ? 0 : a.style === 'Murattal' ? -1 : 1
    if (a.qiraat === 'hafs') return -1
    if (b.qiraat === 'hafs') return 1
    return getQiraat(a.qiraat).short.localeCompare(getQiraat(b.qiraat).short)
  })
}

/** Reciters marked as well-known/mainstream — the "Top" filter. */
export function topReciters(): Reciter[] {
  return RECITERS.filter((r) => r.top)
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
