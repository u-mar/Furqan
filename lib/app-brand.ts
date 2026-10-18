/** App display name and brand constants. The logo itself is in lib/app-logo.ts. */

import { LOGO_GROUND } from '@/lib/app-logo'

/**
 * Naba (نبأ), "news": the Quran is "the great news" (an-naba' al-ʿaẓīm, 78:2).
 * Older internal names (storage keys, the Cloudinary folder, the speech
 * service) still say "nadir"; they are never shown, and renaming them would
 * reset people's settings or break saved links.
 */
export const APP_NAME = 'Naba'

/** The icon's own near-black, so the launch screen and the icon are one colour. */
export const APP_ICON_THEME_COLOR = LOGO_GROUND

/**
 * Where people can reach you about their data. Shown on the privacy policy,
 * terms and account deletion page, and both app stores require one that
 * actually works. Cloudflare Email Routing forwards it to the owner's inbox.
 */
export const SUPPORT_EMAIL = 'support@qurannaba.com'

/** Shown on the privacy policy. Update whenever the policy text changes. */
export const PRIVACY_UPDATED = '12 October 2026'

/** Shown on the terms of service. Update whenever the terms text changes. */
export const TERMS_UPDATED = '1 October 2026'
