/**
 * Every mushaf page has its own QCF font, and the fonts differ in their
 * vertical metrics. The browser places a line's text by those metrics, so on
 * some pages every line's baseline (the line the letters rest on) sat a few
 * pixels higher or lower in its row than on the next page: turning pages,
 * the whole page of text jumped up and down.
 *
 * The rows themselves are the same on every page (fifteen equal rows), so
 * the fix measures where the baseline actually falls in its row on each page
 * as laid out, and moves the text so it falls in the same place on all of
 * them. (The font's own numbers, read from a canvas or a sample line, did not
 * always agree with the page, so only the page itself is measured.)
 */

/**
 * Where the baseline is brought to on every page, as a share of the row's
 * height from its top: about where the fonts put it on their own (roughly
 * 0.63 to 0.67), so no page moves far.
 */
const TARGET_BASELINE = 0.65

/** Lines measured per page: enough that one odd line cannot sway it. */
const SAMPLE_LINES = 5

function isLoaded(family: string): boolean {
  const target = family.replace(/["']/g, '').trim()
  for (const face of document.fonts) {
    if (face.family.replace(/["']/g, '').trim() === target && face.status === 'loaded') return true
  }
  return false
}

/** How far (in em of its text) `glyphs`' baseline is from where it should be in its row. */
function offsetEm(glyphs: HTMLElement): number | null {
  const row = glyphs.closest<HTMLElement>('.mushaf-qcf-line')
  const size = parseFloat(getComputedStyle(glyphs).fontSize)
  if (!row || !(size > 0)) return null
  const box = row.getBoundingClientRect()
  if (!(box.height > 0)) return null
  const marker = document.createElement('span')
  marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  glyphs.appendChild(marker)
  const baseline = marker.getBoundingClientRect().top - box.top
  marker.remove()
  return Number.isFinite(baseline) ? (TARGET_BASELINE * box.height - baseline) / size : null
}

/**
 * Moves a page's lines (`glyphs`, set in `family`) so their baselines fall at
 * the same height in their rows as on every other page, through the
 * `--qcf-baseline-shift` property on `page`. Waits for the font: measuring a
 * stand-in font would be measuring the wrong thing.
 */
export function alignQcfBaselines(page: HTMLElement, glyphs: HTMLElement[], family: string): void {
  if (typeof document === 'undefined' || !document.fonts || !isLoaded(family) || glyphs.length === 0) return
  page.style.setProperty('--qcf-baseline-shift', '0em')
  const measured = glyphs
    .slice(0, SAMPLE_LINES)
    .map(offsetEm)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  if (measured.length === 0) return
  const median = measured[Math.floor(measured.length / 2)]
  page.style.setProperty('--qcf-baseline-shift', `${median.toFixed(4)}em`)
}
