/**
 * Renders a shareable verse card as a PNG, in the app's "Ink & Verdigris"
 * printed-mushaf style: paper ground, warm ink, a single verdigris accent,
 * hairline rules and the eight-point ornament.
 *
 * 1080x1350 (4:5) — the aspect that survives WhatsApp status, Instagram
 * feed/story crops and Twitter previews without cutting the text.
 */

import { APP_NAME } from '@/lib/app-brand'

export interface VerseImageInput {
  arabic: string
  translation?: string | null
  /** e.g. "Al-Baqarah" */
  surahName: string
  /** e.g. "2:255" */
  verseKey: string
  /** e.g. "Saheeh International" */
  translator?: string | null
}

const W = 1080
const H = 1350

/* Paper palette — deliberately the light theme regardless of the app's current
   theme: a shared image reads as a printed page, and stays legible wherever
   it lands. */
const PAPER = '#f4f1e8'
const INK = '#1c1a16'
const INK_SOFT = '#4a473f'
const MUTED = '#6a675e'
const ACCENT = '#0f7a6a'
const RULE = 'rgba(28, 26, 22, 0.16)'
const RULE_SOFT = 'rgba(28, 26, 22, 0.10)'

/** Eight-point star (rub' al-hizb), from IconOrnament — 24x24 viewBox. */
const ORNAMENT_PATH =
  'M23 12l-6.75 1.76 3.53 6.02-6.02-3.53L12 23l-1.76-6.75-6.02 3.53 3.53-6.02L1 12l6.75-1.76-3.53-6.02 6.02 3.53L12 1l1.76 6.75 6.02-3.53-3.53 6.02z'

function cssFontStack(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value ? `${value}, ${fallback}` : fallback
}

/** next/font generates hashed family names — pull them off the CSS variables. */
function fontStacks() {
  return {
    arabic: cssFontStack('--font-amiri', "'Amiri', serif"),
    serif: cssFontStack('--font-home-serif', "'Fraunces', Georgia, serif"),
    sans: cssFontStack('--font-sans', "system-ui, sans-serif"),
  }
}

async function ensureFontsReady(arabicSample: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const { arabic, serif, sans } = fontStacks()
  try {
    await Promise.all([
      document.fonts.load(`76px ${arabic}`, arabicSample.slice(0, 120)),
      document.fonts.load(`600 34px ${serif}`, 'Sample'),
      document.fonts.load(`500 24px ${sans}`, 'Sample'),
      document.fonts.ready,
    ])
  } catch {
    /* fall back to whatever is available */
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

interface FittedBlock {
  lines: string[]
  fontSize: number
  lineHeight: number
  height: number
}

/** Shrink the type until the wrapped block fits the space it's given. */
function fitBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    fontStack: string
    weight?: string
    maxWidth: number
    maxHeight: number
    startSize: number
    minSize: number
    lineHeightRatio: number
  }
): FittedBlock {
  const { fontStack, weight = '', maxWidth, maxHeight, startSize, minSize, lineHeightRatio } = opts

  let fontSize = startSize
  let lines: string[] = []
  let lineHeight = fontSize * lineHeightRatio

  while (fontSize >= minSize) {
    ctx.font = `${weight} ${fontSize}px ${fontStack}`.trim()
    lines = wrapLines(ctx, text, maxWidth)
    lineHeight = fontSize * lineHeightRatio
    if (lines.length * lineHeight <= maxHeight) break
    fontSize -= 2
  }

  return { lines, fontSize, lineHeight, height: lines.length * lineHeight }
}

function drawOrnament(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  const path = new Path2D(ORNAMENT_PATH)
  const scale = size / 24
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(scale, scale)
  ctx.fillStyle = color
  ctx.fill(path)
  ctx.restore()
}

/** line — ornament — line */
function drawOrnamentRule(
  ctx: CanvasRenderingContext2D,
  cy: number,
  halfSpan: number,
  starSize: number
): void {
  const gap = starSize * 1.5
  ctx.strokeStyle = RULE
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W / 2 - halfSpan, cy)
  ctx.lineTo(W / 2 - gap, cy)
  ctx.moveTo(W / 2 + gap, cy)
  ctx.lineTo(W / 2 + halfSpan, cy)
  ctx.stroke()
  drawOrnament(ctx, W / 2, cy, starSize, ACCENT)
}

function drawTrackedCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  fontSize: number,
  fontStack: string,
  color: string
): void {
  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = color
  ctx.font = `600 ${fontSize}px ${fontStack}`
  // letterSpacing is Chrome 99+/Safari 17+; harmless where unsupported.
  ctx.letterSpacing = `${Math.round(fontSize * 0.22)}px`
  ctx.fillText(text.toUpperCase(), cx, y)
  ctx.letterSpacing = '0px'
  ctx.restore()
}

export async function renderVerseImage(input: VerseImageInput): Promise<Blob> {
  const { arabic, translation, surahName, verseKey, translator } = input

  await ensureFontsReady(arabic)
  const fonts = fontStacks()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available on this device')

  /* Paper ground */
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  /* Double-rule frame, matching the reader's verse card */
  ctx.strokeStyle = RULE
  ctx.lineWidth = 2
  ctx.strokeRect(46, 46, W - 92, H - 92)
  ctx.strokeStyle = RULE_SOFT
  ctx.lineWidth = 1
  ctx.strokeRect(60, 60, W - 120, H - 120)

  /* Masthead */
  drawTrackedCaps(ctx, APP_NAME, W / 2, 152, 25, fonts.sans, MUTED)
  drawOrnamentRule(ctx, 206, 300, 22)

  /* ---- Measure both blocks, then centre the pair in the open space ---- */
  const contentTop = 260
  const contentBottom = H - 260
  const available = contentBottom - contentTop

  const arabicBlock = fitBlock(ctx, arabic, {
    fontStack: fonts.arabic,
    maxWidth: W - 240,
    maxHeight: available * (translation ? 0.62 : 0.92),
    startSize: 84,
    minSize: 38,
    lineHeightRatio: 1.95,
  })

  const trimmedTranslation = (translation || '').replace(/\s+/g, ' ').trim()
  const translationBlock = trimmedTranslation
    ? fitBlock(ctx, trimmedTranslation, {
        fontStack: fonts.serif,
        weight: '500',
        maxWidth: W - 320,
        maxHeight: available * 0.34,
        startSize: 38,
        minSize: 22,
        lineHeightRatio: 1.55,
      })
    : null

  const dividerSpace = translationBlock ? 96 : 0
  const groupHeight = arabicBlock.height + dividerSpace + (translationBlock?.height ?? 0)
  let cursorY = contentTop + (available - groupHeight) / 2

  /* ---- Arabic ---- */
  ctx.save()
  ctx.direction = 'rtl'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = INK
  ctx.font = `${arabicBlock.fontSize}px ${fonts.arabic}`
  for (const line of arabicBlock.lines) {
    cursorY += arabicBlock.lineHeight
    ctx.fillText(line, W / 2, cursorY - arabicBlock.lineHeight * 0.28)
  }
  ctx.restore()

  /* ---- Divider + translation ---- */
  if (translationBlock) {
    cursorY += dividerSpace / 2
    drawOrnamentRule(ctx, cursorY, 120, 16)
    cursorY += dividerSpace / 2

    ctx.save()
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK_SOFT
    ctx.font = `500 ${translationBlock.fontSize}px ${fonts.serif}`
    for (const line of translationBlock.lines) {
      cursorY += translationBlock.lineHeight
      ctx.fillText(line, W / 2, cursorY - translationBlock.lineHeight * 0.3)
    }
    ctx.restore()
  }

  /* ---- Footer: reference + translator credit ---- */
  const footerRuleY = H - 214
  ctx.strokeStyle = RULE_SOFT
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W / 2 - 190, footerRuleY)
  ctx.lineTo(W / 2 + 190, footerRuleY)
  ctx.stroke()

  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = ACCENT
  ctx.font = `600 36px ${fonts.serif}`
  ctx.fillText(`Surah ${surahName}`, W / 2, footerRuleY + 62)

  ctx.fillStyle = MUTED
  ctx.font = `500 26px ${fonts.sans}`
  ctx.fillText(verseKey, W / 2, footerRuleY + 104)

  if (translator) {
    ctx.fillStyle = 'rgba(106, 103, 94, 0.75)'
    ctx.font = `400 21px ${fonts.sans}`
    ctx.fillText(`— ${translator}`, W / 2, footerRuleY + 146)
  }
  ctx.restore()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the verse image'))),
      'image/png'
    )
  })
}

/**
 * Share the rendered card through the OS share sheet, falling back to a
 * download when file sharing is unavailable (desktop, older browsers).
 */
export async function shareVerseImage(input: VerseImageInput): Promise<'shared' | 'downloaded'> {
  const blob = await renderVerseImage(input)
  const fileName = `${APP_NAME.replace(/\s+/g, '-')}-${input.verseKey.replace(':', '-')}.png`
  const file = new File([blob], fileName, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `${input.surahName} ${input.verseKey}`,
      })
      return 'shared'
    } catch (err) {
      // User dismissed the sheet — not an error worth surfacing.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
      throw err
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
