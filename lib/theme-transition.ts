/**
 * Changes the theme with the new one spreading out in a circle from where it was asked for (the
 * button tapped), over the old. Uses the browser's own page transition; where there is none, or the
 * phone asks for less motion, the theme simply changes.
 *
 * `change` must change the page at once (the classes on <html>), not later.
 */
type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> }
}

const DURATION_MS = 550

export function revealTheme(change: () => void, from?: { x: number; y: number }): void {
  if (typeof document === 'undefined') return change()
  const doc = document as TransitionDocument
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduce || document.hidden) return change()

  const x = from?.x ?? window.innerWidth / 2
  const y = from?.y ?? 0
  // Far enough to cover the farthest corner.
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const root = document.documentElement
  root.classList.add('theme-reveal')
  // The browser waits for the screen to draw before it runs the change: if that does not come soon
  // (a page in the background), the theme changes anyway, without the animation.
  let changed = false
  const changeOnce = () => {
    if (changed) return
    changed = true
    change()
  }
  const fallback = window.setTimeout(() => {
    root.classList.remove('theme-reveal')
    changeOnce()
  }, 300)
  try {
    const transition = doc.startViewTransition(() => {
      window.clearTimeout(fallback)
      changeOnce()
    })
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: DURATION_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
        )
      })
      .catch(() => {})
    transition.finished.finally(() => root.classList.remove('theme-reveal')).catch(() => {})
  } catch {
    window.clearTimeout(fallback)
    root.classList.remove('theme-reveal')
    changeOnce()
  }
}
