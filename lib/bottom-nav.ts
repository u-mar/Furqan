/**
 * The bottom tab bar (Read, Home, Qari, Listen) shown on Home, Listen and
 * throughout Qari, Prayer, Halaqa and Hifdh Test. The mushaf still hides it
 * to keep the whole screen for reading, and the Qari record screen hides it
 * too — that's a single task with its own way out.
 */

/** The bar's own height, in rem — not counting the phone's safe area below it. */
export const BOTTOM_NAV_HEIGHT_REM = 4.25

/** Exact pathnames the bar appears on, beyond the whole Qari, Prayer, Halaqa and Hifdh sections. */
export const BOTTOM_NAV_PATHS = ['/', '/listen'] as const

export function showBottomNavFor(pathname: string): boolean {
  if (pathname === '/qari/record') return false
  if (pathname.startsWith('/qari')) return true
  if (pathname.startsWith('/prayer')) return true
  if (pathname.startsWith('/halaqa')) return true
  // The surprise-ayah test is a full mushaf reader, same as /read — it keeps
  // the whole screen for the page, same as the mushaf hides the bar too.
  if (pathname === '/hifdh/random') return false
  if (pathname.startsWith('/hifdh')) return true
  return (BOTTOM_NAV_PATHS as readonly string[]).includes(pathname)
}
