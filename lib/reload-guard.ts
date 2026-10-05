/**
 * Work that a page reload would lose — a post still going up. The app reloads
 * itself when a new version of it is installed (components/PwaRegister.tsx);
 * while anything here is held, that reload waits.
 *
 * Kept on its own, with nothing to import, so every page can check it cheaply.
 */

let held = 0

/** Holds off reloads until the returned function is called. */
export function holdReload(): () => void {
  held += 1
  let released = false
  return () => {
    if (released) return
    released = true
    held -= 1
  }
}

export function canReload(): boolean {
  return held === 0
}
