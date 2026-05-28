/** App display name and generated icon styling (PWA / favicon). */

export const APP_NAME = 'Al Furqaan'

/** Arabic fa (ف) — from Al-Furqaan (الفُرقان). */
export const APP_ICON_LETTER = 'ف'

export const APP_ICON_THEME_COLOR = '#3d5234'

/** Shared palette for OG ImageResponse icons. */
export const appIconStyles = {
  background: 'linear-gradient(155deg, #7a9b62 0%, #5d7a48 32%, #3d5234 68%, #243020 100%)',
  letterColor: '#faf3e4',
  innerGlow: 'rgba(255, 248, 235, 0.12)',
} as const

export function appIconLetterStyle(fontSize: number): {
  color: string
  fontSize: number
  fontWeight: number
  fontFamily: string
} {
  return {
    color: appIconStyles.letterColor,
    fontSize,
    fontWeight: 700,
    fontFamily: 'serif',
  }
}

export function appIconShellStyle(borderRadius: number | string): Record<string, string | number> {
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: appIconStyles.background,
    borderRadius,
  }
}
