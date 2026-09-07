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

export interface VerseImageBackground {
  id: string
  label: string
  src: string
  /** Reference-line colour, picked to sit with this photo rather than one gold for all. */
  accent: string
}

/**
 * Bundled with the app (Unsplash licence), grouped so the picker reads in a
 * sensible order: sacred first, then calm light, nature, and the quieter
 * everyday scenes that suit verses about hardship, mercy and gratitude.
 */
export const VERSE_IMAGE_BACKGROUNDS: VerseImageBackground[] = [
  // Sacred
  { id: 'mosque-arches', label: 'Mosque arches', src: '/share-bg/mosque-arches.jpg', accent: '#e8d3a8' },
  { id: 'mosque-columns', label: 'Mosque columns', src: '/share-bg/mosque-columns.jpg', accent: '#f0d9a6' },
  { id: 'kiswah-gold', label: 'Gold calligraphy', src: '/share-bg/kiswah-gold.jpg', accent: '#f3d489' },
  { id: 'islamic-pattern', label: 'Pattern', src: '/share-bg/islamic-pattern.jpg', accent: '#ffd9a3' },
  { id: 'quran-flowers', label: 'Quran & flowers', src: '/share-bg/quran-flowers.jpg', accent: '#f6c9cd' },
  { id: 'quran-ornate', label: 'Mushaf', src: '/share-bg/quran-ornate.jpg', accent: '#eccf9c' },
  { id: 'tasbih', label: 'Tasbih', src: '/share-bg/tasbih.jpg', accent: '#a8e0d2' },
  { id: 'sujood', label: 'In prayer', src: '/share-bg/sujood.jpg', accent: '#a9dcc4' },

  // Light and sky
  { id: 'sunrise', label: 'Sunrise', src: '/share-bg/sunrise.jpg', accent: '#ffd8a0' },
  { id: 'above-clouds', label: 'Above the clouds', src: '/share-bg/above-clouds.jpg', accent: '#ffc9a8' },
  { id: 'night-sky', label: 'Night sky', src: '/share-bg/night-sky.jpg', accent: '#d4c2f0' },
  { id: 'milky-way', label: 'Milky way', src: '/share-bg/milky-way.jpg', accent: '#bcd2f5' },
  { id: 'candle', label: 'Candle', src: '/share-bg/candle.jpg', accent: '#ffcf94' },
  { id: 'lantern', label: 'Lantern', src: '/share-bg/lantern.jpg', accent: '#ffd39a' },
  { id: 'bokeh-lights', label: 'City lights', src: '/share-bg/bokeh-lights.jpg', accent: '#ffc9b0' },
  { id: 'silhouette', label: 'Dusk', src: '/share-bg/silhouette.jpg', accent: '#e6c6ea' },

  // Nature
  { id: 'still-water', label: 'Still water', src: '/share-bg/still-water.jpg', accent: '#a9d8e6' },
  { id: 'blue-hills', label: 'Blue hills', src: '/share-bg/blue-hills.jpg', accent: '#b4d4e8' },
  { id: 'peaks', label: 'Peaks', src: '/share-bg/peaks.jpg', accent: '#f2c3b4' },
  { id: 'cliffs', label: 'Cliffs', src: '/share-bg/cliffs.jpg', accent: '#bfe0c4' },
  { id: 'river', label: 'River', src: '/share-bg/river.jpg', accent: '#b6e2c6' },
  { id: 'forest', label: 'Forest', src: '/share-bg/forest.jpg', accent: '#c8e4b8' },
  { id: 'woodland', label: 'Woodland', src: '/share-bg/woodland.jpg', accent: '#c4e2bb' },
  { id: 'old-tree', label: 'Old tree', src: '/share-bg/old-tree.jpg', accent: '#dbe6b4' },
  { id: 'sunlight', label: 'Sunlight', src: '/share-bg/sunlight.jpg', accent: '#e4dfa6' },
  { id: 'meadow', label: 'Meadow', src: '/share-bg/meadow.jpg', accent: '#ffe0a0' },
  { id: 'poppies', label: 'Poppies', src: '/share-bg/poppies.jpg', accent: '#ffc7bd' },
  { id: 'soft-bloom', label: 'Soft bloom', src: '/share-bg/soft-bloom.jpg', accent: '#f8cddc' },

  // Quiet everyday
  { id: 'rain-window', label: 'Rain (warm)', src: '/share-bg/rain-window.jpg', accent: '#e8d5a4' },
  { id: 'rain-cool', label: 'Rain (cool)', src: '/share-bg/rain-cool.jpg', accent: '#aed8de' },
  { id: 'misty-road', label: 'Open road', src: '/share-bg/misty-road.jpg', accent: '#ecd9a6' },
  { id: 'teacup', label: 'Quiet morning', src: '/share-bg/teacup.jpg', accent: '#e9cfae' },
  { id: 'elderly-hands', label: 'Elder hands', src: '/share-bg/elderly-hands.jpg', accent: '#e2cdb2' },
  { id: 'small-hand', label: 'Small hand', src: '/share-bg/small-hand.jpg', accent: '#dcdcdc' },
  { id: 'hospital', label: 'Hospital', src: '/share-bg/hospital.jpg', accent: '#a9dde0' },
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
    cursorY += dividerSpace

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
    ctx.fillStyle = background.accent
    ctx.font = `600 27px ${fonts.serif}`
    ctx.fillText(`Surah ${surahName} · ${verseKey}${partial ? ' (part)' : ''}`, W / 2, H - 218)
  })

  /* ---- Wordmark ---- */
  withShadow(() => {
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = MUTED
    ctx.font = `600 34px ${fonts.serif}`
    ctx.letterSpacing = '6px'
    ctx.fillText(APP_NAME, W / 2, H - 110)
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
