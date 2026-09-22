/**
 * The bottom tab bar (Read, Home, Qari, Listen) shown on Home and Listen.
 * Tapping Read or Qari carries you into a screen with its own deeper
 * structure — the mushaf, and Qari's own Feed/Record/You bar — so the bar
 * hides itself there rather than stacking two bars.
 */

/** The bar's own height, in rem — not counting the phone's safe area below it. */
export const BOTTOM_NAV_HEIGHT_REM = 4.25

/** Exact pathnames the bar appears on. */
export const BOTTOM_NAV_PATHS = ['/', '/listen'] as const

export function showBottomNavFor(pathname: string): boolean {
  return (BOTTOM_NAV_PATHS as readonly string[]).includes(pathname)
}
