/**
 * Self-computed Hijri (tabular Islamic calendar) conversion — deliberately not
 * using `Intl.DateTimeFormat` with an islamic calendar, since browser/ICU
 * support for it is inconsistent across devices and can silently fall back
 * to Gregorian month names while keeping the Hijri year, producing dates
 * like "March 22, 1448". This algorithm is deterministic everywhere.
 */

const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' I",
  "Rabi' II",
  'Jumada I',
  'Jumada II',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhu al-Qi'dah",
  'Dhu al-Hijjah',
]

export interface HijriDate {
  day: number
  month: number // 1-12
  year: number
  monthName: string
}

function gregorianToJdn(date: Date): number {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3

  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

export function toHijri(date: Date): HijriDate {
  const jdn = gregorianToJdn(date)

  let l = jdn - 1948440 + 10632
  const n = Math.floor((l - 1) / 10631)
  l = l - 10631 * n + 354
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238)
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29
  const month = Math.floor((24 * l) / 709)
  const day = l - Math.floor((709 * month) / 24)
  const year = 30 * n + j - 30

  return { day, month, year, monthName: HIJRI_MONTHS[month - 1] || '' }
}

/** e.g. "Rabi' I 21, 1448 AH" */
export function formatHijri(date: Date): string {
  const { day, year, monthName } = toHijri(date)
  return `${monthName} ${day}, ${year} AH`
}
