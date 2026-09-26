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

import { APP_ICON_LETTER, APP_NAME } from '@/lib/app-brand'
import { loadPageFont, qcfFontFamily } from '@/lib/mushaf-fonts'
import { tr } from '@/lib/i18n-core'
import { SHARE_BACKGROUNDS, type ShareBackground } from '@/lib/share-backgrounds'

const W = 1080
const H = 1350

export type VerseImageBackground = ShareBackground

/** Bundled with the app; see lib/share-backgrounds.ts for the list. */
export const VERSE_IMAGE_BACKGROUNDS: VerseImageBackground[] = SHARE_BACKGROUNDS

export const DEFAULT_BACKGROUND_ID = VERSE_IMAGE_BACKGROUNDS[0].id

export const DEFAULT_VERSE_FONT_SCALE = 1
export const MIN_VERSE_FONT_SCALE = 0.7
export const MAX_VERSE_FONT_SCALE = 1.3
export const VERSE_FONT_SCALE_STEP = 0.1

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
  /** Multiplier on the Arabic type size, from the user's text-size control. */
  fontScale?: number
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
    img.onerror = () => reject(new Error(tr('Could not load the background image')))
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
  const { words, page, isQcf, translation } = input
  const fontScale = Math.min(
    MAX_VERSE_FONT_SCALE,
    Math.max(MIN_VERSE_FONT_SCALE, input.fontScale ?? DEFAULT_VERSE_FONT_SCALE)
  )

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
          document.fonts.load(`700 30px ${fonts.serif}`, APP_ICON_LETTER),
          document.fonts.ready,
        ]).catch(() => null)
      : null,
  ])

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(tr('Canvas is not available on this device'))

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
  const contentBottom = H - 200
  const available = contentBottom - contentTop

  const arabicBlock = fitBlock(ctx, arabicWords, {
    fontStack: arabicFont,
    maxWidth: W - 210,
    maxHeight: available * (translation ? 0.6 : 0.92),
    startSize: Math.round(78 * fontScale),
    minSize: Math.round(34 * fontScale),
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

  /* ---- The app, small, at the bottom left ---- */
  const margin = 64
  const markSize = 46
  const baseline = H - 64
  withShadow(() => {
    ctx.beginPath()
    ctx.roundRect(margin, baseline - markSize + 6, markSize, markSize, markSize * 0.24)
    ctx.fillStyle = '#000000'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
    ctx.stroke()
    ctx.fillStyle = '#f5ecd8'
    ctx.font = `700 ${Math.round(markSize * 0.62)}px ${fonts.serif}`
    ctx.direction = 'ltr'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(APP_ICON_LETTER, margin + markSize / 2, baseline - markSize / 2 + 6 + markSize * 0.04)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = MUTED
    ctx.font = `600 26px ${fonts.serif}`
    ctx.fillText(`${APP_NAME} App`, margin + markSize + 16, baseline - 8)
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(tr('Could not render the verse image')))),
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
