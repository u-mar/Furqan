/**
 * Renders a shareable verse card as a PNG over a calm photographic
 * background.
 *
 * Photos live in /public/share-bg and ship with the app, so sharing works
 * offline and never depends on a third-party image host at the moment
 * someone taps Share.
 *
 * The Arabic is drawn with the mushaf's own QCF glyph font — the same script
 * the reader uses — falling back to Amiri only when the page font can't load.
 *
 * 1080x1350 (4:5) — the aspect that survives WhatsApp status, Instagram
 * feed/story crops and Twitter previews without cutting the text.
 */

import { APP_NAME } from '@/lib/app-brand'
import { loadPageFont, qcfFontFamily } from '@/lib/mushaf-fonts'

const W = 1080
const H = 1350

/** Eight-point star (rub' al-hizb), from IconOrnament — 24x24 viewBox. */
const ORNAMENT_PATH =
  'M23 12l-6.75 1.76 3.53 6.02-6.02-3.53L12 23l-1.76-6.75-6.02 3.53 3.53-6.02L1 12l6.75-1.76-3.53-6.02 6.02 3.53L12 1l1.76 6.75 6.02-3.53-3.53 6.02z'

export interface VerseImageBackground {
  id: string
  label: string
  src: string
}

/**
 * Bundled with the app (Unsplash licence), grouped so the picker reads in a
 * sensible order: sacred first, then calm light, nature, and the quieter
 * everyday scenes that suit verses about hardship, mercy and gratitude.
 */
export const VERSE_IMAGE_BACKGROUNDS: VerseImageBackground[] = [
  // Sacred
  { id: 'mosque-arches', label: 'Mosque arches', src: '/share-bg/mosque-arches.jpg' },
  { id: 'mosque-columns', label: 'Mosque columns', src: '/share-bg/mosque-columns.jpg' },
  { id: 'kiswah-gold', label: 'Gold calligraphy', src: '/share-bg/kiswah-gold.jpg' },
  { id: 'islamic-pattern', label: 'Pattern', src: '/share-bg/islamic-pattern.jpg' },
  { id: 'quran-flowers', label: 'Quran & flowers', src: '/share-bg/quran-flowers.jpg' },
  { id: 'quran-ornate', label: 'Mushaf', src: '/share-bg/quran-ornate.jpg' },
  { id: 'tasbih', label: 'Tasbih', src: '/share-bg/tasbih.jpg' },
  { id: 'sujood', label: 'In prayer', src: '/share-bg/sujood.jpg' },

  // Light and sky
  { id: 'sunrise', label: 'Sunrise', src: '/share-bg/sunrise.jpg' },
  { id: 'above-clouds', label: 'Above the clouds', src: '/share-bg/above-clouds.jpg' },
  { id: 'night-sky', label: 'Night sky', src: '/share-bg/night-sky.jpg' },
  { id: 'milky-way', label: 'Milky way', src: '/share-bg/milky-way.jpg' },
  { id: 'candle', label: 'Candle', src: '/share-bg/candle.jpg' },
  { id: 'lantern', label: 'Lantern', src: '/share-bg/lantern.jpg' },
  { id: 'bokeh-lights', label: 'City lights', src: '/share-bg/bokeh-lights.jpg' },
  { id: 'silhouette', label: 'Dusk', src: '/share-bg/silhouette.jpg' },

  // Nature
  { id: 'still-water', label: 'Still water', src: '/share-bg/still-water.jpg' },
  { id: 'blue-hills', label: 'Blue hills', src: '/share-bg/blue-hills.jpg' },
  { id: 'peaks', label: 'Peaks', src: '/share-bg/peaks.jpg' },
  { id: 'cliffs', label: 'Cliffs', src: '/share-bg/cliffs.jpg' },
  { id: 'river', label: 'River', src: '/share-bg/river.jpg' },
  { id: 'forest', label: 'Forest', src: '/share-bg/forest.jpg' },
  { id: 'woodland', label: 'Woodland', src: '/share-bg/woodland.jpg' },
  { id: 'old-tree', label: 'Old tree', src: '/share-bg/old-tree.jpg' },
  { id: 'sunlight', label: 'Sunlight', src: '/share-bg/sunlight.jpg' },
  { id: 'meadow', label: 'Meadow', src: '/share-bg/meadow.jpg' },
  { id: 'poppies', label: 'Poppies', src: '/share-bg/poppies.jpg' },
  { id: 'soft-bloom', label: 'Soft bloom', src: '/share-bg/soft-bloom.jpg' },

  // Quiet everyday
  { id: 'rain-window', label: 'Rain (warm)', src: '/share-bg/rain-window.jpg' },
  { id: 'rain-cool', label: 'Rain (cool)', src: '/share-bg/rain-cool.jpg' },
  { id: 'misty-road', label: 'Open road', src: '/share-bg/misty-road.jpg' },
  { id: 'teacup', label: 'Quiet morning', src: '/share-bg/teacup.jpg' },
  { id: 'elderly-hands', label: 'Elder hands', src: '/share-bg/elderly-hands.jpg' },
  { id: 'small-hand', label: 'Small hand', src: '/share-bg/small-hand.jpg' },
  { id: 'hospital', label: 'Hospital', src: '/share-bg/hospital.jpg' },
]

export const DEFAULT_BACKGROUND_ID = VERSE_IMAGE_BACKGROUNDS[0].id

export interface VerseImageInput {
  /** Arabic words in reading order — sliced already if sharing part of an ayah. */
  words: string[]
  /** Mushaf page, used to pick the QCF glyph font. 0 to force the fallback. */
  page: number
  /** True when `words` are QCF glyph codes rather than plain Uthmani text. */
  isQcf: boolean
  translation?: string | null
  /** e.g. "Al-Baqarah" */
  surahName: string
  /** e.g. "2:255" */
  verseKey: string
  /** Marks the card as a portion of the ayah rather than the whole. */
  partial?: boolean
  backgroundId?: string
}

const INK = '#ffffff'
const INK_SOFT = 'rgba(255, 255, 255, 0.92)'
const MUTED = 'rgba(255, 255, 255, 0.72)'
const ACCENT = '#f2dfae'
const RULE = 'rgba(255, 255, 255, 0.32)'
const RULE_SOFT = 'rgba(255, 255, 255, 0.18)'

function cssFontStack(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return value ? `${value}, ${fallback}` : fallback
}

function fontStacks() {
  return {
    arabic: cssFontStack('--font-amiri', "'Amiri', serif"),
    serif: cssFontStack('--font-home-serif', "'Fraunces', Georgia, serif"),
    sans: cssFontStack('--font-sans', 'system-ui, sans-serif'),
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the background image'))
    img.src = src
  })
}

function wrapLines(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
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
  words: string[],
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
    lines = wrapLines(ctx, words, maxWidth)
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

/** Cover-fit the photo, then lay scrims over it so the type always reads. */
function paintBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight)
  const dw = img.naturalWidth * scale
  const dh = img.naturalHeight * scale
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)

  /* Overall darkening — photos vary wildly in brightness, this evens them out */
  ctx.fillStyle = 'rgba(10, 14, 18, 0.46)'
  ctx.fillRect(0, 0, W, H)

  /* Heavier at top and bottom, where the type sits */
  const scrim = ctx.createLinearGradient(0, 0, 0, H)
  scrim.addColorStop(0, 'rgba(6, 10, 14, 0.55)')
  scrim.addColorStop(0.35, 'rgba(6, 10, 14, 0.12)')
  scrim.addColorStop(0.68, 'rgba(6, 10, 14, 0.28)')
  scrim.addColorStop(1, 'rgba(6, 10, 14, 0.72)')
  ctx.fillStyle = scrim
  ctx.fillRect(0, 0, W, H)

  /* Vignette */
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(4, 8, 12, 0.5)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  /* Hairline frame */
  ctx.strokeStyle = RULE_SOFT
  ctx.lineWidth = 1.5
  ctx.strokeRect(52, 52, W - 104, H - 104)
}

export async function renderVerseImage(input: VerseImageInput): Promise<Blob> {
  const { words, page, isQcf, translation, surahName, verseKey, partial } = input

  const background =
    VERSE_IMAGE_BACKGROUNDS.find((b) => b.id === input.backgroundId) ?? VERSE_IMAGE_BACKGROUNDS[0]

  const fonts = fontStacks()

  /* Prefer the mushaf's own script; fall back to Amiri if it won't load. */
  let arabicFont = fonts.arabic
  let arabicWords = words
  if (isQcf && page > 0) {
    const ok = await loadPageFont(page, words.join('').slice(0, 12)).catch(() => false)
    if (ok) arabicFont = `"${qcfFontFamily(page)}", ${fonts.arabic}`
    else arabicWords = words
  }

  const [bgImage] = await Promise.all([
    loadImage(background.src),
    typeof document !== 'undefined' && document.fonts
      ? Promise.all([
          document.fonts.load(`600 34px ${fonts.serif}`, 'Sample'),
          document.fonts.load(`500 24px ${fonts.sans}`, 'Sample'),
          document.fonts.ready,
        ]).catch(() => null)
      : null,
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available on this device')

  paintBackground(ctx, bgImage)

  const withShadow = (draw: () => void) => {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 22
    ctx.shadowOffsetY = 2
    draw()
    ctx.restore()
  }

  /* ---- Measure both blocks, then centre the pair in the open space ---- */
  const contentTop = 240
  const contentBottom = H - 300
  const available = contentBottom - contentTop

  const arabicBlock = fitBlock(ctx, arabicWords, {
    fontStack: arabicFont,
    maxWidth: W - 210,
    maxHeight: available * (translation ? 0.6 : 0.92),
    startSize: 92,
    minSize: 40,
    lineHeightRatio: 1.85,
  })

  const trimmedTranslation = (translation || '').replace(/\s+/g, ' ').trim()
  const translationBlock = trimmedTranslation
    ? fitBlock(ctx, trimmedTranslation.split(/\s+/), {
        fontStack: fonts.serif,
        weight: '500',
        maxWidth: W - 300,
        maxHeight: available * 0.36,
        startSize: 38,
        minSize: 22,
        lineHeightRatio: 1.55,
      })
    : null

  const dividerSpace = translationBlock ? 92 : 0
  const groupHeight = arabicBlock.height + dividerSpace + (translationBlock?.height ?? 0)
  let cursorY = contentTop + (available - groupHeight) / 2

  /* ---- Arabic ---- */
  withShadow(() => {
    ctx.direction = 'rtl'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.font = `${arabicBlock.fontSize}px ${arabicFont}`
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
    drawOrnamentRule(ctx, cursorY, 120, 16)
    cursorY += dividerSpace / 2

    withShadow(() => {
      ctx.direction = 'ltr'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = INK_SOFT
      ctx.font = `500 ${translationBlock.fontSize}px ${fonts.serif}`
      let y = cursorY
      for (const line of translationBlock.lines) {
        y += translationBlock.lineHeight
        ctx.fillText(line, W / 2, y - translationBlock.lineHeight * 0.3)
      }
    })
  }

  /* ---- Reference ---- */
  withShadow(() => {
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = ACCENT
    ctx.font = `600 36px ${fonts.serif}`
    ctx.fillText(
      `Surah ${surahName} · ${verseKey}${partial ? ' (part)' : ''}`,
      W / 2,
      H - 224
    )
  })

  /* ---- Wordmark ---- */
  drawOrnamentRule(ctx, H - 168, 150, 15)
  withShadow(() => {
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = MUTED
    ctx.font = `600 40px ${fonts.serif}`
    ctx.letterSpacing = '6px'
    ctx.fillText(APP_NAME, W / 2, H - 108)
    ctx.letterSpacing = '0px'
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the verse image'))),
      'image/jpeg',
      0.92
    )
  })
}

/**
 * Share an already-rendered card through the OS share sheet, falling back to a
 * download when file sharing is unavailable (desktop, older browsers).
 *
 * Takes a rendered blob rather than rendering here on purpose: iOS Safari only
 * honours `navigator.share` inside a user gesture, and awaiting a render first
 * breaks that chain. Render on selection, share on tap.
 */
export async function shareVerseBlob(
  blob: Blob,
  meta: { verseKey: string; surahName: string }
): Promise<'shared' | 'downloaded'> {
  const fileName = `${APP_NAME.replace(/\s+/g, '-')}-${meta.verseKey.replace(':', '-')}.jpg`
  const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })

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
