/**
 * Renders a shareable verse card as a PNG.
 *
 * Backgrounds are drawn procedurally (gradient grounds, an eight-point
 * ornament medallion, vignette and grain) rather than bundled photography —
 * no licensing to worry about, nothing to download, works offline, and every
 * share can come out looking different.
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
  /** Pick a specific background; omit for a random one. */
  themeId?: VerseImageThemeId
}

const W = 1080
const H = 1350

/** Eight-point star (rub' al-hizb), from IconOrnament — 24x24 viewBox. */
const ORNAMENT_PATH =
  'M23 12l-6.75 1.76 3.53 6.02-6.02-3.53L12 23l-1.76-6.75-6.02 3.53 3.53-6.02L1 12l6.75-1.76-3.53-6.02 6.02 3.53L12 1l1.76 6.75 6.02-3.53-3.53 6.02z'

export type VerseImageThemeId = 'paper' | 'midnight' | 'emerald' | 'dawn' | 'sand'

interface VerseImageTheme {
  id: VerseImageThemeId
  label: string
  /** Vertical gradient stops, top to bottom. */
  gradient: string[]
  ink: string
  inkSoft: string
  muted: string
  accent: string
  rule: string
  ruleSoft: string
  /** Faint medallion behind the verse. */
  medallion: string
  /** Scatter faint stars (night skies). */
  stars?: boolean
  /** Darken the edges so the type holds. */
  vignette?: string
}

export const VERSE_IMAGE_THEMES: VerseImageTheme[] = [
  {
    id: 'paper',
    label: 'Paper',
    gradient: ['#f6f3ea', '#efeadd'],
    ink: '#1c1a16',
    inkSoft: '#413e37',
    muted: '#6a675e',
    accent: '#0f7a6a',
    rule: 'rgba(28, 26, 22, 0.16)',
    ruleSoft: 'rgba(28, 26, 22, 0.10)',
    medallion: 'rgba(28, 26, 22, 0.035)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    gradient: ['#070d20', '#101a3d', '#1d2b57'],
    ink: '#f4f1e8',
    inkSoft: '#dcd7c9',
    muted: '#9aa3c0',
    accent: '#e3bd7a',
    rule: 'rgba(244, 241, 232, 0.22)',
    ruleSoft: 'rgba(244, 241, 232, 0.12)',
    medallion: 'rgba(227, 189, 122, 0.06)',
    stars: true,
    vignette: 'rgba(3, 6, 16, 0.55)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    gradient: ['#05130e', '#0b2a22', '#124036'],
    ink: '#f1ede3',
    inkSoft: '#d8d3c6',
    muted: '#8fb3a8',
    accent: '#5cc4ab',
    rule: 'rgba(241, 237, 227, 0.2)',
    ruleSoft: 'rgba(241, 237, 227, 0.11)',
    medallion: 'rgba(92, 196, 171, 0.06)',
    vignette: 'rgba(2, 10, 7, 0.5)',
  },
  {
    id: 'dawn',
    label: 'Dawn',
    gradient: ['#2b1630', '#6d2f45', '#c9714b'],
    ink: '#fdf6ec',
    inkSoft: '#f0e0d0',
    muted: '#e8c3ab',
    accent: '#ffd9a0',
    rule: 'rgba(253, 246, 236, 0.24)',
    ruleSoft: 'rgba(253, 246, 236, 0.13)',
    medallion: 'rgba(255, 217, 160, 0.07)',
    vignette: 'rgba(30, 10, 25, 0.45)',
  },
  {
    id: 'sand',
    label: 'Sand',
    gradient: ['#2a2118', '#4a3a27', '#6d543a'],
    ink: '#f7efe1',
    inkSoft: '#e4d8c4',
    muted: '#c3ab8c',
    accent: '#e8c88f',
    rule: 'rgba(247, 239, 225, 0.22)',
    ruleSoft: 'rgba(247, 239, 225, 0.12)',
    medallion: 'rgba(232, 200, 143, 0.07)',
    vignette: 'rgba(20, 14, 8, 0.45)',
  },
]

function pickTheme(themeId?: VerseImageThemeId): VerseImageTheme {
  if (themeId) {
    const found = VERSE_IMAGE_THEMES.find((t) => t.id === themeId)
    if (found) return found
  }
  return VERSE_IMAGE_THEMES[Math.floor(Math.random() * VERSE_IMAGE_THEMES.length)]
}

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
    sans: cssFontStack('--font-sans', 'system-ui, sans-serif'),
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
  starSize: number,
  theme: VerseImageTheme
): void {
  const gap = starSize * 1.5
  ctx.strokeStyle = theme.rule
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(W / 2 - halfSpan, cy)
  ctx.lineTo(W / 2 - gap, cy)
  ctx.moveTo(W / 2 + gap, cy)
  ctx.lineTo(W / 2 + halfSpan, cy)
  ctx.stroke()
  drawOrnament(ctx, W / 2, cy, starSize, theme.accent)
}

function paintBackground(ctx: CanvasRenderingContext2D, theme: VerseImageTheme): void {
  /* Gradient ground */
  const grad = ctx.createLinearGradient(0, 0, W * 0.25, H)
  theme.gradient.forEach((stop, i) => {
    grad.addColorStop(i / Math.max(1, theme.gradient.length - 1), stop)
  })
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  /* Star field for the night skies */
  if (theme.stars) {
    for (let i = 0; i < 160; i += 1) {
      const x = Math.random() * W
      const y = Math.random() * H * 0.72
      const r = Math.random() * 1.7 + 0.35
      ctx.globalAlpha = Math.random() * 0.5 + 0.12
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  /* Faint ornament medallion behind the verse */
  drawOrnament(ctx, W / 2, H * 0.44, 700, theme.medallion)

  /* Corner ornaments */
  const corner = 34
  for (const [cx, cy] of [
    [110, 118],
    [W - 110, 118],
    [110, H - 118],
    [W - 110, H - 118],
  ] as const) {
    drawOrnament(ctx, cx, cy, corner, theme.ruleSoft)
  }

  /* Vignette so type stays legible over the brighter gradient stops */
  if (theme.vignette) {
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.78)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, theme.vignette)
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, W, H)
  }

  /* Fine grain — keeps large flat gradients from looking plastic */
  ctx.save()
  for (let i = 0; i < 1400; i += 1) {
    ctx.globalAlpha = Math.random() * 0.035
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000'
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4)
  }
  ctx.restore()
  ctx.globalAlpha = 1

  /* Double-rule frame */
  ctx.strokeStyle = theme.rule
  ctx.lineWidth = 2
  ctx.strokeRect(46, 46, W - 92, H - 92)
  ctx.strokeStyle = theme.ruleSoft
  ctx.lineWidth = 1
  ctx.strokeRect(60, 60, W - 120, H - 120)
}

export async function renderVerseImage(input: VerseImageInput): Promise<Blob> {
  const { arabic, translation, surahName, verseKey } = input
  const theme = pickTheme(input.themeId)

  await ensureFontsReady(arabic)
  const fonts = fontStacks()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available on this device')

  paintBackground(ctx, theme)

  /* Soft shadow keeps Arabic readable over the livelier grounds */
  const withTextShadow = (draw: () => void) => {
    ctx.save()
    if (theme.vignette) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 2
    }
    draw()
    ctx.restore()
  }

  /* ---- Measure both blocks, then centre the pair in the open space ---- */
  const contentTop = 250
  const contentBottom = H - 300
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
  withTextShadow(() => {
    ctx.direction = 'rtl'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = theme.ink
    ctx.font = `${arabicBlock.fontSize}px ${fonts.arabic}`
    let y = cursorY
    for (const line of arabicBlock.lines) {
      y += arabicBlock.lineHeight
      ctx.fillText(line, W / 2, y - arabicBlock.lineHeight * 0.28)
    }
  })
  cursorY += arabicBlock.height

  /* ---- Divider + translation ---- */
  if (translationBlock) {
    cursorY += dividerSpace / 2
    drawOrnamentRule(ctx, cursorY, 120, 16, theme)
    cursorY += dividerSpace / 2

    withTextShadow(() => {
      ctx.direction = 'ltr'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = theme.inkSoft
      ctx.font = `500 ${translationBlock.fontSize}px ${fonts.serif}`
      let y = cursorY
      for (const line of translationBlock.lines) {
        y += translationBlock.lineHeight
        ctx.fillText(line, W / 2, y - translationBlock.lineHeight * 0.3)
      }
    })
  }

  /* ---- Reference ---- */
  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.accent
  ctx.font = `600 36px ${fonts.serif}`
  ctx.fillText(`Surah ${surahName} · ${verseKey}`, W / 2, H - 224)
  ctx.restore()

  /* ---- Wordmark: ornament rule, then the app name as the signature ---- */
  drawOrnamentRule(ctx, H - 168, 150, 15, theme)

  ctx.save()
  ctx.direction = 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.ink
  ctx.font = `600 44px ${fonts.serif}`
  ctx.letterSpacing = '6px'
  ctx.fillText(APP_NAME, W / 2, H - 108)
  ctx.letterSpacing = '0px'
  ctx.restore()

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the verse image'))),
      'image/png'
    )
  })
}

/**
 * Share an already-rendered card through the OS share sheet, falling back to a
 * download when file sharing is unavailable (desktop, older browsers).
 *
 * Takes a rendered blob rather than rendering here on purpose: iOS Safari only
 * honours `navigator.share` inside a user gesture, and awaiting a render first
 * breaks that chain. Render on theme selection, share on tap.
 */
export async function shareVerseBlob(
  blob: Blob,
  meta: { verseKey: string; surahName: string }
): Promise<'shared' | 'downloaded'> {
  const fileName = `${APP_NAME.replace(/\s+/g, '-')}-${meta.verseKey.replace(':', '-')}.png`
  const file = new File([blob], fileName, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: `${meta.surahName} ${meta.verseKey}`,
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
