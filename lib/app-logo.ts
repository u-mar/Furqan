/**
 * Naba's logo: the word نبأ in square Kufic. The baseline, the alif and the
 * teeth of the ba and the noon are a soft white; the noon's dot above, the
 * ba's dot below and the alif's hamza (a squared "c") are gold, on a
 * plain black square.
 *
 * The blocks are drawn on a 200-unit square with the word centred in it, so
 * the app icons, the sign-in screen, the splash and the share images all
 * scale the same shapes.
 */

export const LOGO_GROUND = '#000000'
export const LOGO_INK = '#f1f3ef'
export const LOGO_GOLD = '#e0bc74'

/** The side of the square the blocks are drawn on. */
export const LOGO_BOX = 200

/** A block: [x, y, width, height] on the square. */
export type LogoBlock = readonly [number, number, number, number]

/** The letters. The alif and the two teeth run down into the baseline, so the joins have no seam. */
export const LOGO_LETTERS: readonly LogoBlock[] = [
  [40, 127, 120, 14], // the baseline joining the three letters
  [40, 57, 14, 84], // alif
  [93, 99, 14, 42], // ba
  [146, 99, 14, 42], // noon
]

/** The dots and the hamza. */
export const LOGO_MARKS: readonly LogoBlock[] = [
  [146, 71, 14, 14], // the noon's dot, above
  [93, 155, 14, 14], // the ba's dot, below
  [40, 31, 15, 5], // the hamza over the alif: top,
  [40, 31, 5, 16], // side
  [40, 42, 15, 5], // and foot
]

/** How much every block's corners are rounded, on the same square. */
export const LOGO_BLOCK_RADIUS = 1.5

/**
 * The viewBox that shows the word at `scale` times its drawn size, still
 * centred: 1 leaves the margin of an app icon around it, more crops in closer.
 */
export function logoViewBox(scale = 1): string {
  const side = LOGO_BOX / scale
  const start = (LOGO_BOX - side) / 2
  return `${start} ${start} ${side} ${side}`
}

/** Draws the word (no square behind it) into a canvas square of `size` at (x, y). */
export function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  { ink = LOGO_INK, gold = LOGO_GOLD }: { ink?: string; gold?: string } = {}
): void {
  const k = size / LOGO_BOX
  const fill = (blocks: readonly LogoBlock[], color: string) => {
    ctx.beginPath()
    for (const [bx, by, bw, bh] of blocks) {
      ctx.roundRect(x + bx * k, y + by * k, bw * k, bh * k, LOGO_BLOCK_RADIUS * k)
    }
    ctx.fillStyle = color
    ctx.fill()
  }
  fill(LOGO_LETTERS, ink)
  fill(LOGO_MARKS, gold)
}
