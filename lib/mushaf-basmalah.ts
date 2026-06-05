/** Surahs that open without a separate bismillah line (Fatiha includes it in ayah 1; At-Tawbah has none). */
export function surahHasOpeningBasmalah(chapter: number): boolean {
  return chapter !== 1 && chapter !== 9
}

export const BASMALAH_ARABIC = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'
export const BASMALAH_ORNAMENT = '﷽'
