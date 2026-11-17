/**
 * Holds the page still while a sheet or full-screen panel is open over it.
 *
 * Shared by everything that needs it, and released only when the last one closes. Each used to
 * save "how it was before me" and put that back on closing: with two open (Now playing, then a
 * sheet over it) closing in the other order, the second put back "held", and the page stayed
 * frozen with nothing open, until the app was restarted.
 */
let holders = 0
let before = ''

/** Holds the page's scrolling; call what it returns to let go (once, however often it is called). */
export function lockPageScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (holders === 0) {
    before = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  holders += 1
  let released = false
  return () => {
    if (released) return
    released = true
    holders = Math.max(0, holders - 1)
    if (holders === 0) document.body.style.overflow = before
  }
}
