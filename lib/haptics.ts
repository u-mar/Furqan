/**
 * Small vibrations that confirm a touch landed.
 *
 * Android browsers vibrate; iPhone browsers ignore the call entirely, so these
 * are always safe to fire. Kept short: a tap should feel like a click, not a buzz.
 */

function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    // Some browsers throw when vibration is blocked by the user or the OS.
  }
}

/** A light tick — likes, toggles, choosing an option. */
export function tapFeedback(): void {
  vibrate(10)
}

/** Something started or stopped — recording, a countdown step. */
export function strongFeedback(): void {
  vibrate(22)
}

/** Something finished well — published, a file is ready. */
export function successFeedback(): void {
  vibrate([14, 60, 24])
}
