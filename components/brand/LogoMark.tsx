import {
  LOGO_BLOCK_RADIUS,
  LOGO_GOLD,
  LOGO_INK,
  LOGO_LETTERS,
  LOGO_MARKS,
  logoViewBox,
} from '@/lib/app-logo'

/**
 * Naba's mark, نبأ in square Kufic, filling its box. Decorative: wherever it
 * appears the name is written beside it or the screen says what it is.
 * `scale` crops in on the word (1 keeps an app icon's margin around it).
 */
export default function LogoMark({
  className,
  scale = 1,
  ink = LOGO_INK,
  gold = LOGO_GOLD,
}: {
  className?: string
  scale?: number
  ink?: string
  gold?: string
}) {
  return (
    <svg viewBox={logoViewBox(scale)} className={className} aria-hidden focusable="false">
      {LOGO_LETTERS.map(([x, y, width, height], index) => (
        <rect key={`l${index}`} x={x} y={y} width={width} height={height} rx={LOGO_BLOCK_RADIUS} fill={ink} />
      ))}
      {LOGO_MARKS.map(([x, y, width, height], index) => (
        <rect key={`m${index}`} x={x} y={y} width={width} height={height} rx={LOGO_BLOCK_RADIUS} fill={gold} />
      ))}
    </svg>
  )
}
