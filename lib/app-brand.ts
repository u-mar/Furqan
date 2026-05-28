/** App display name and generated icon styling (PWA / favicon). */

export const APP_NAME = 'Al Furqaan'

/** Arabic fa (ف) — from Al-Furqaan (الفُرقان). */
export const APP_ICON_LETTER = 'ف'

export const APP_ICON_THEME_COLOR = '#000000'

/** Shared palette for OG ImageResponse icons. */
export const appIconStyles = {
  background: '#000000',
  letterColor: '#f5ecd8',
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
