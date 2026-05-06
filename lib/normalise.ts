const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g
const TATWEEL = /ـ/g
const ALEF_VARIANTS = /[آأإ]/g

export function normalise(text: string): string {
  return text
    .replace(HARAKAT, '')
    .replace(TATWEEL, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
}
