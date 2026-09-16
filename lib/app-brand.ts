/** App display name and generated icon styling (PWA / favicon). */

export const APP_NAME = 'Al Furqaan'

/** Arabic fa (ف) — from Al-Furqaan (الفُرقان). */
export const APP_ICON_LETTER = 'ف'

export const APP_ICON_THEME_COLOR = '#000000'

/**
 * Where people can reach you about their data. Shown on the privacy policy,
 * and both app stores require one that actually works.
 *
 * TODO before store submission: replace with a real, monitored address.
 */
export const SUPPORT_EMAIL = 'support@example.com'

/** Shown on the privacy policy. Update whenever the policy text changes. */
export const PRIVACY_UPDATED = '16 September 2026'

/** Shown on the terms of service. Update whenever the terms text changes. */
export const TERMS_UPDATED = '16 September 2026'

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
