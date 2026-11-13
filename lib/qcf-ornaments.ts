/**
 * In print an ayah's number is black inside a coloured frame, and a surah's
 * name is black inside a coloured banner. In the QCF fonts each of those is a
 * single glyph, frame and number drawn together, so one `color` paints both.
 *
 * They can still be told apart by where they are: the frame is the same
 * drawing in every page font, and the number (or name) always sits inside it.
 * So this finds where each ornament's ink falls in its own box and hands that
 * to CSS (`--ink-x`, `--ink-y`, …), which clips a two-colour background to the
 * glyph: ink in the middle, the frame's colour around it (see `[data-inked]`
 * in globals.css). An ornament that could not be measured keeps one colour.
 *
 * Each glyph is measured on its own because the page fonts do not agree: the
 * same ornament has a different advance, and sits at a different offset, from
 * one page to the next and even from one ayah to the next. And it is measured
 * by drawing it, because the numbers a canvas reports for a glyph's bounds are
 * rounded to 1/64 em, which is as wide as the gap between a three-digit number
 * and its frame.
 */
import { isFontLoaded } from '@/lib/qcf-baseline'

/** Where a glyph's ink is, in em: across from the left of its advance, and above and below its baseline. */
interface InkBox {
  left: number
  right: number
  above: number
  below: number
}

/** Size the glyph is drawn at to be measured: a hundredth of an em is over a pixel. */
const RASTER_PX = 128
const CANVAS_WIDTH = 512
const CANVAS_HEIGHT = 224
const PAD = 4

/**
 * The frame of the ayah ornament is not centred on its own ink: the flourish
 * above it is a little shorter than the one below, so the ring the number sits
 * in is this far (em) below the middle of the glyph.
 */
const RING_BELOW_CENTRE = 0.018

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
const inkCache = new Map<string, InkBox>()

function measureInk(fontFamily: string, text: string): InkBox | null {
  const key = `${fontFamily}|${text}`
  const known = inkCache.get(key)
  if (known) return known

  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    // Read back often and never shown: kept in memory, not on the GPU.
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!ctx) return null

  ctx.font = `${RASTER_PX}px ${fontFamily}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.direction = 'ltr'
  const metrics = ctx.measureText(text)
  const originX = Math.ceil(metrics.actualBoundingBoxLeft) + PAD
  const baselineY = Math.ceil(metrics.actualBoundingBoxAscent) + PAD
  const width = originX + Math.ceil(metrics.actualBoundingBoxRight) + PAD
  const height = baselineY + Math.ceil(metrics.actualBoundingBoxDescent) + PAD
  if (!(width > PAD * 2) || !(height > PAD * 2) || width > CANVAS_WIDTH || height > CANVAS_HEIGHT) return null

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#000'
  ctx.fillText(text, originX, baselineY)
  const pixels = ctx.getImageData(0, 0, width, height).data

  // The most ink in each column and each row. The outermost ones are only
  // partly covered, and how much says where within that pixel the edge is.
  const columns = new Uint8Array(width)
  const rows = new Uint8Array(height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3]
      if (alpha > columns[x]) columns[x] = alpha
      if (alpha > rows[y]) rows[y] = alpha
    }
  }
  const first = (line: Uint8Array) => {
    for (let i = 0; i < line.length; i += 1) if (line[i] > 0) return i
    return -1
  }
  const last = (line: Uint8Array) => {
    for (let i = line.length - 1; i >= 0; i -= 1) if (line[i] > 0) return i
    return -1
  }
  const x0 = first(columns)
  const x1 = last(columns)
  const y0 = first(rows)
  const y1 = last(rows)
  if (x0 < 0 || y0 < 0) return null

  const ink: InkBox = {
    left: (x0 + 1 - columns[x0] / 255 - originX) / RASTER_PX,
    right: (x1 + columns[x1] / 255 - originX) / RASTER_PX,
    above: (baselineY - (y0 + 1 - rows[y0] / 255)) / RASTER_PX,
    below: (y1 + rows[y1] / 255 - baselineY) / RASTER_PX,
  }
  inkCache.set(key, ink)
  return ink
}

/** How far below `el`'s top edge its own text baseline is, in px. */
function baselineBelowTop(el: HTMLElement): number {
  const probe = document.createElement('span')
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
  el.insertBefore(probe, el.firstChild)
  const offset = probe.getBoundingClientRect().top - el.getBoundingClientRect().top
  probe.remove()
  return offset
}

interface Ornament {
  el: HTMLElement
  family: string
  fontSize: number
  glyph: string
  /** From the left of `el`'s content box to the left of the glyph's advance, in px. */
  glyphLeft: number
}

/** What is known about an ornament from the page alone, or null if it is not ready to be measured. */
function readOrnament(el: HTMLElement, range: Range): Ornament | null {
  const node = el.firstChild
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  // Flowing text keeps a space inside the ornament's span, after the glyph.
  const glyph = (node.nodeValue ?? '').replace(/[\s ]+$/, '')
  if (!glyph) return null
  const style = getComputedStyle(el)
  const fontSize = parseFloat(style.fontSize)
  const family = style.fontFamily
  if (!(fontSize > 0) || !isFontLoaded(family.split(',')[0])) return null
  range.setStart(node, 0)
  range.setEnd(node, glyph.length)
  const contentLeft = el.getBoundingClientRect().left + (parseFloat(style.paddingLeft) || 0)
  return { el, family, fontSize, glyph, glyphLeft: range.getBoundingClientRect().left - contentLeft }
}

/**
 * Measures every ornament under `root` that matches `selector` and has not
 * been done, and gives each to `place` with where its ink is in its own box.
 * `expect` turns away anything that is not the drawing it should be, such as
 * a fallback font's glyph.
 */
function inkOrnaments(
  root: HTMLElement,
  selector: string,
  expect: (ink: InkBox) => boolean,
  place: (el: HTMLElement, ink: { left: number; top: number; width: number; height: number }) => void
): void {
  const pending = Array.from(
    root.querySelectorAll<HTMLElement>(
      selector
        .split(',')
        .map((part) => `${part.trim()}:not([data-inked])`)
        .join(', ')
    )
  )
  if (pending.length === 0) return

  // Everything is read before anything is written, so the page is laid out once.
  const range = document.createRange()
  const found: Array<Ornament & { ink: InkBox }> = []
  for (const el of pending) {
    const ornament = readOrnament(el, range)
    const ink = ornament ? measureInk(ornament.family, ornament.glyph) : null
    if (ornament && ink && expect(ink)) found.push({ ...ornament, ink })
  }
  range.detach()
  if (found.length === 0) return

  // The baseline is in the same place in every ornament of one font and size.
  const baselines = new Map<string, number>()
  for (const { el, family, fontSize } of found) {
    const key = `${family}|${fontSize}`
    if (!baselines.has(key)) baselines.set(key, baselineBelowTop(el) / fontSize)
  }

  for (const { el, family, fontSize, glyphLeft, ink } of found) {
    const baseline = baselines.get(`${family}|${fontSize}`)
    if (baseline === undefined || !Number.isFinite(baseline)) continue
    place(el, {
      left: glyphLeft / fontSize + ink.left,
      top: baseline - ink.above,
      width: ink.right - ink.left,
      height: ink.above + ink.below,
    })
    el.setAttribute('data-inked', '')
  }
}

const em = (value: number) => `${value.toFixed(4)}em`

/**
 * Marks where the number is in each ayah ornament under `root`, and where the
 * name is in each surah banner, so they can be inked apart from their frames.
 * Safe to call often: ornaments already done are skipped.
 */
export function inkQcfOrnaments(root: HTMLElement): void {
  if (typeof document === 'undefined' || !document.fonts) return

  // The ayah ornament: about 0.8 em wide and 1 em tall in every page font.
  inkOrnaments(
    root,
    '.mushaf-qcf-segment--end',
    (ink) => {
      const width = ink.right - ink.left
      const height = ink.above + ink.below
      return width > 0.72 && width < 0.9 && height > 0.92 && height < 1.1
    },
    (el, ink) => {
      el.style.setProperty('--ink-x', em(ink.left + ink.width / 2))
      el.style.setProperty('--ink-y', em(ink.top + ink.height / 2 + RING_BELOW_CENTRE))
    }
  )

  // The surah banner: a strip about 3.25 em by 0.4 em, the same on every surah,
  // with the name in the middle quarter of its width. The band given to CSS is
  // the middle 55% across and the strip's full height; CSS inks its centre.
  inkOrnaments(
    root,
    '.mushaf-qcf-line__surah-glyph',
    (ink) => {
      const width = ink.right - ink.left
      const height = ink.above + ink.below
      return width > 3 && width < 3.5 && height > 0.34 && height < 0.46
    },
    (el, ink) => {
      el.style.setProperty('--ink-x', em(ink.left + ink.width * 0.225))
      el.style.setProperty('--ink-y', em(ink.top))
      el.style.setProperty('--ink-w', em(ink.width * 0.55))
      el.style.setProperty('--ink-h', em(ink.height))
    }
  )
}
