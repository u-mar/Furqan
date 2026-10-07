/**
 * Where the reader just came from, for screens whose Back should not simply
 * retrace their steps (see hooks/useBackGoesHome.ts).
 *
 * BottomNav notes each screen once it has shown. A screen's own mount effect
 * runs before that (children's effects run before later siblings'), so from
 * there `cameFrom()` is still the screen before it.
 */

let shown: string | null = null
let arrivedByBack = false
let listening = false

function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('popstate', () => {
    arrivedByBack = true
  })
}

export function notePath(path: string): void {
  listen()
  shown = path
  arrivedByBack = false
}

/** The screen shown before this one; null when the app opened here. */
export function cameFrom(): string | null {
  return shown
}

/** Whether this screen was reached with Back or Forward rather than opened. */
export function cameBack(): boolean {
  return arrivedByBack
}
