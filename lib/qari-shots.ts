/**
 * Where a recitation's video cuts from one clip to the next — the same in the
 * swipe view and in the video shared from it. As in a Quran edit, every ayah
 * gets a scene of its own: the cut lands on the moment the reciter starts it,
 * and the translation changes with it. An ayah too long for one scene is split
 * evenly, and two ayat too close together share one.
 */

/** A scene shorter than this reads as a flicker, so a quick ayah shares the scene before it. */
export const MIN_SHOT_SECONDS = 3
/** Longer than this one clip starts to repeat, so a long ayah is given more than one. */
export const MAX_SHOT_SECONDS = 12

/**
 * When each scene starts, in seconds from the beginning, given when each ayah
 * starts and how long the recitation lasts. Always starts with 0.
 */
export function shotStarts(ayahStarts: number[], seconds: number): number[] {
  const cuts = [0]
  for (const t of [...ayahStarts].sort((a, b) => a - b)) {
    const last = cuts[cuts.length - 1]
    if (t - last >= MIN_SHOT_SECONDS && seconds - t >= MIN_SHOT_SECONDS) cuts.push(t)
  }
  const starts: number[] = []
  cuts.forEach((from, k) => {
    const to = cuts[k + 1] ?? seconds
    const pieces = Math.max(1, Math.ceil((to - from) / MAX_SHOT_SECONDS))
    for (let p = 0; p < pieces; p += 1) starts.push(from + ((to - from) * p) / pieces)
  })
  return starts
}

/** Which scene is on screen at `seconds`. */
export function shotAt(starts: number[], seconds: number): number {
  let shot = 0
  while (shot + 1 < starts.length && starts[shot + 1] <= seconds) shot += 1
  return shot
}
