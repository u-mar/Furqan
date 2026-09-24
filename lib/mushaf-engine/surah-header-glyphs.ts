/**
 * One glyph per surah (1–114), from QUL's ligature map for
 * `QCF_SurahHeader_COLOR-Regular.ttf` — each character is reassigned in that
 * font to draw the full ornate surah-name banner, not a letterform. Index 0
 * is unused so `SURAH_HEADER_GLYPHS[chapterNumber]` reads directly.
 */
export const SURAH_HEADER_GLYPHS: readonly string[] = [
  '',
  'ﱅ', 'ﱆ', 'ﱇ', 'ﱊ', 'ﱋ', 'ﱎ', 'ﱏ', 'ﱑ', 'ﱒ', 'ﱓ',
  'ﱕ', 'ﱖ', 'ﱘ', 'ﱚ', 'ﱛ', 'ﱜ', 'ﱝ', 'ﱞ', 'ﱡ', 'ﱢ',
  'ﱤ', 'ﭑ', 'ﭒ', 'ﭔ', 'ﭕ', 'ﭗ', 'ﭘ', 'ﭚ', 'ﭛ', 'ﭝ',
  'ﭞ', 'ﭠ', 'ﭡ', 'ﭣ', 'ﭤ', 'ﭦ', 'ﭧ', 'ﭩ', 'ﭪ', 'ﭬ',
  'ﭭ', 'ﭯ', 'ﭰ', 'ﭲ', 'ﭳ', 'ﭵ', 'ﭶ', 'ﭸ', 'ﭹ', 'ﭻ',
  'ﭼ', 'ﭾ', 'ﭿ', 'ﮁ', 'ﮂ', 'ﮄ', 'ﮅ', 'ﮇ', 'ﮈ', 'ﮊ',
  'ﮋ', 'ﮍ', 'ﮎ', 'ﮐ', 'ﮑ', 'ﮓ', 'ﮔ', 'ﮖ', 'ﮗ', 'ﮙ',
  'ﮚ', 'ﮜ', 'ﮝ', 'ﮟ', 'ﮠ', 'ﮢ', 'ﮣ', 'ﮥ', 'ﮦ', 'ﮨ',
  'ﮩ', 'ﮫ', 'ﮬ', 'ﮮ', 'ﮯ', 'ﮱ', '﮲', '﮴', '﮵', '﮷',
  '﮸', '﮺', '﮻', '﮽', '﮾', '﯀', '﯁', 'ﯓ', 'ﯔ', 'ﯖ',
  'ﯗ', 'ﯙ', 'ﯚ', 'ﯜ', 'ﯝ', 'ﯟ', 'ﯠ', 'ﯢ', 'ﯣ', 'ﯥ',
  'ﯦ', 'ﯨ', 'ﯩ', 'ﯫ',
]

export function surahHeaderGlyph(chapterNumber: number): string {
  return SURAH_HEADER_GLYPHS[chapterNumber] ?? ''
}
