/**
 * The sheikhs a recitation can imitate.
 *
 * A fixed list rather than free text so every imitation of one sheikh lands
 * on one page — people spell names a dozen ways (#sufi, #suufi, #sheikhsufi),
 * and a tag per spelling would scatter them.
 *
 * Names only, never photos: using a sheikh's picture needs permission, and the
 * app must not look like any of them endorse it.
 */

export interface Sheikh {
  id: string
  /** Full name, for headings. */
  name: string
  /** What fits on a chip or a dropdown row. */
  shortName: string
  /** Other spellings people search with, including Somali and Arabic. */
  aliases: string[]
}

export const SHEIKHS: Sheikh[] = [
  {
    id: 'abdirashid-sufi',
    name: 'Sheikh Abdirashid Ali Sufi',
    shortName: 'Sheikh Sufi',
    aliases: ['sufi', 'suufi', 'abdirashid', 'abdirashiid', 'cabdirashiid', 'cabdirashid', 'ali sufi', 'cali suufi', 'صوفي'],
  },
  {
    id: 'sudais',
    name: 'Abdul Rahman Al-Sudais',
    shortName: 'Al-Sudais',
    aliases: ['sudais', 'sudeis', 'sudays', 'sudes', 'abdurrahman sudais', 'السديس'],
  },
  {
    id: 'alafasy',
    name: 'Mishary Rashid Alafasy',
    shortName: 'Mishary Alafasy',
    aliases: ['mishary', 'mishari', 'alafasy', 'afasy', 'alafasi', 'afasi', 'العفاسي'],
  },
  {
    id: 'abdul-basit',
    name: 'Abdul Basit Abdul Samad',
    shortName: 'Abdul Basit',
    aliases: ['abdul basit', 'abdulbasit', 'abdelbasset', 'basit', 'cabdul baasid', 'عبد الباسط'],
  },
  {
    id: 'husary',
    name: 'Mahmoud Khalil Al-Husary',
    shortName: 'Al-Husary',
    aliases: ['husary', 'husari', 'hussary', 'hosary', 'الحصري'],
  },
  {
    id: 'minshawi',
    name: 'Mohamed Siddiq Al-Minshawi',
    shortName: 'Al-Minshawi',
    aliases: ['minshawi', 'menshawi', 'minshawy', 'المنشاوي'],
  },
  {
    id: 'muaiqly',
    name: 'Maher Al-Muaiqly',
    shortName: 'Maher Al-Muaiqly',
    aliases: ['maher', 'muaiqly', 'muaiqli', 'mueaqly', 'المعيقلي'],
  },
  {
    id: 'shuraim',
    name: 'Saud Al-Shuraim',
    shortName: 'Al-Shuraim',
    aliases: ['shuraim', 'shuraym', 'shreem', 'الشريم'],
  },
  {
    id: 'ghamdi',
    name: 'Saad Al-Ghamdi',
    shortName: 'Saad Al-Ghamdi',
    aliases: ['ghamdi', 'ghamidi', 'saad', 'الغامدي'],
  },
  {
    id: 'dosari',
    name: 'Yasser Al-Dosari',
    shortName: 'Yasser Al-Dosari',
    aliases: ['yasser', 'yasir', 'dosari', 'dossari', 'dosary', 'الدوسري'],
  },
  {
    id: 'shatri',
    name: 'Abu Bakr Al-Shatri',
    shortName: 'Abu Bakr Al-Shatri',
    aliases: ['shatri', 'shatry', 'abu bakr', 'الشاطري'],
  },
  {
    id: 'qatami',
    name: 'Nasser Al-Qatami',
    shortName: 'Nasser Al-Qatami',
    aliases: ['qatami', 'katami', 'nasser', 'القطامي'],
  },
  {
    id: 'ajmi',
    name: 'Ahmed Al-Ajmi',
    shortName: 'Ahmed Al-Ajmi',
    aliases: ['ajmi', 'ajami', 'العجمي'],
  },
  {
    id: 'abkar',
    name: 'Idris Abkar',
    shortName: 'Idris Abkar',
    aliases: ['abkar', 'idris', 'idrees', 'أبكر'],
  },
  {
    id: 'islam-sobhi',
    name: 'Islam Sobhi',
    shortName: 'Islam Sobhi',
    aliases: ['sobhi', 'subhi', 'islam sobhi', 'إسلام صبحي'],
  },
  {
    id: 'baleela',
    name: 'Bandar Baleela',
    shortName: 'Bandar Baleela',
    aliases: ['baleela', 'balila', 'bandar', 'بليلة'],
  },
]

const BY_ID = new Map(SHEIKHS.map((s) => [s.id, s]))

/**
 * The letter that stands for a sheikh, since there is never a photo: the first
 * letter of his family name in Arabic, without "ال" (صوفي → ص, السديس → س).
 */
export function sheikhLetter(sheikh: Sheikh): string {
  const arabic = sheikh.aliases.find((alias) => /[؀-ۿ]/.test(alias))
  if (!arabic) return sheikh.shortName.replace(/^(Sheikh|Al-)\s*/i, '').charAt(0).toUpperCase()
  const last = arabic.trim().split(/\s+/).pop() ?? arabic
  return last.replace(/^ال/, '').charAt(0)
}

export function findSheikh(id: string | null | undefined): Sheikh | null {
  return id ? (BY_ID.get(id) ?? null) : null
}

export function isSheikhId(id: string): boolean {
  return BY_ID.has(id)
}

/** Lower-case, no titles, no "al-", no punctuation — so "Sheekh Al-Suufi" meets "suufi". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(sheikh|sheekh|shaykh|shaikh|shiekh|sh|qari|imam|imaam)\b\.?/g, ' ')
    .replace(/\b(al|el|as|ash|ar|ad)[-\s]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The sheikh a search is about, if it clearly names one.
 *
 * Short fragments only count as an exact spelling ("ali" is not Sheikh Ali
 * Sufi), so typing a qari's name never flips the results to a sheikh by accident.
 */
export function matchSheikh(query: string): Sheikh | null {
  const q = normalize(query.replace(/^#/, ''))
  if (q.length < 3) return null

  for (const sheikh of SHEIKHS) {
    const names = [...sheikh.aliases, sheikh.shortName, sheikh.name].map(normalize)
    const hit = names.some(
      (name) =>
        name === q ||
        (q.length >= 4 && name.split(' ').some((word) => word.startsWith(q))) ||
        (name.length >= 4 && ` ${q} `.includes(` ${name} `))
    )
    if (hit) return sheikh
  }
  return null
}
