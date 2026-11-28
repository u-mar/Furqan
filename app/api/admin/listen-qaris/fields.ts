import { QIRAAT } from '@/lib/reciters'

const STYLES = ['Murattal', 'Mujawwad', "Mu'allim"]

export interface ListenQariFields {
  name?: string
  nameAr?: string | null
  country?: string
  city?: string | null
  qiraat?: string
  style?: string
  username?: string | null
  published?: boolean
}

/**
 * A name typed in capitals or in small letters ("OMAR MUSTAFA", "omar mustafa") written as the
 * well-known reciters' are: "Omar Mustafa". Joined parts keep their own capital ("Al-Hassan").
 * A name already in mixed case is left as typed.
 */
export function titleCase(name: string): string {
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name
  return name.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase())
}

/** The fields of a Listen qari the admin sent, checked; an error message for the first bad one. */
export function readFields(body: Record<string, unknown>): ListenQariFields | string {
  const out: ListenQariFields = {}
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
  if ('name' in body) {
    out.name = titleCase(text(body.name, 80))
    if (!out.name) return 'Enter a name.'
  }
  if ('nameAr' in body) out.nameAr = text(body.nameAr, 80) || null
  if ('country' in body) {
    out.country = text(body.country, 2).toUpperCase()
    if (!/^[A-Z]{2}$/.test(out.country)) return 'Choose a country.'
  }
  if ('city' in body) out.city = text(body.city, 60) || null
  if ('qiraat' in body) {
    out.qiraat = text(body.qiraat, 30)
    if (!QIRAAT.some((q) => q.id === out.qiraat)) return 'Choose a narration.'
  }
  if ('style' in body) {
    out.style = text(body.style, 20)
    if (!STYLES.includes(out.style)) return 'Choose a style.'
  }
  if ('username' in body) out.username = text(body.username, 40).replace(/^@/, '').toLowerCase() || null
  if ('published' in body) out.published = body.published === true
  return out
}
