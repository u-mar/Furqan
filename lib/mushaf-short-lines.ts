/**
 * The lines the printed Madani mushaf (1421H) leaves short, centred rather than full width, by page:
 * 26 in all, such as the opening pages. Every other line is set full width (the V4 page
 * fonts' words are spread to fill it, as in print). Measured once from the V2 page fonts, each line
 * against its page's typical line (scratchpad short_lines.py; under 93% counts as short).
 */
const SHORT_LINES: Record<number, readonly number[]> = { 1: [2, 8], 2: [3, 7, 8], 27: [15], 177: [12], 255: [2], 400: [6], 443: [13], 528: [9], 534: [6], 545: [6], 586: [1], 593: [2], 594: [5], 600: [10], 602: [5, 11, 15], 603: [10, 15], 604: [4, 9, 14, 15] }

/** Whether a page's line is one the print leaves short (centred). */
export function isShortMushafLine(page: number, line: number): boolean {
  return SHORT_LINES[page]?.includes(line) ?? false
}
