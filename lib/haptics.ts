/**
 * Small vibrations that confirm a touch landed.
 *
 * Android browsers vibrate. iPhone browsers have no vibration call, but Safari
 * gives the system tick when a switch control is flipped, so on iPhone a hidden
 * one is flipped instead. Both are best-effort and always safe to fire. Kept
 * short: a tap should feel like a click, not a buzz.
 */

let hiddenSwitch: HTMLLabelElement | null = null

function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function isIPhone(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS reports itself as a Mac, but a Mac has no touch screen.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate(pattern)
  } catch {
    // Some browsers throw when vibration is blocked by the user or the OS.
  }
}

function tick(): void {
  try {
    if (!hiddenSwitch) {
      const label = document.createElement('label')
      label.setAttribute('aria-hidden', 'true')
      label.style.display = 'none'
      const input = document.createElement('input')
      input.type = 'checkbox'
      input.setAttribute('switch', '')
      input.tabIndex = -1
      label.appendChild(input)
      document.head.appendChild(label)
      hiddenSwitch = label
    }
    hiddenSwitch.click()
  } catch {
    // Nothing to feel; the screen still shows what happened.
  }
}

function feel(pattern: number | number[], ticks: number): void {
  if (canVibrate()) {
    vibrate(pattern)
    return
  }
  if (!isIPhone()) return
  tick()
  for (let i = 1; i < ticks; i++) window.setTimeout(tick, i * 100)
}

/** A light tick — likes, toggles, choosing an option. */
export function tapFeedback(): void {
  feel(10, 1)
}

/** Something started or stopped — recording, a countdown step. */
export function strongFeedback(): void {
  feel(22, 1)
}

/** Something finished well — published, a file is ready, you read today. */
export function successFeedback(): void {
  feel([14, 60, 24], 2)
}

/** Something did not go through. */
export function errorFeedback(): void {
  feel([28, 50, 28, 50, 28], 3)
}
