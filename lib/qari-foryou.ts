/**
 * The "For You" order of Qari's full-screen feed: a mix, not a ranking.
 *
 * Every public recitation in the pool gets a weight from how it is doing (likes count most, then
 * plays) and how new it is, and the order is then drawn at random by those weights (each item's
 * key is u^(1/weight), u uniform: the weighted shuffle of Efraimidis and Spirakis). Loved and new
 * recitations come up more often, but nothing is fixed: a quiet recitation can come first, and a
 * new draw gives a new order. The draw is seeded, so one viewer's pages stay in one order while
 * they scroll, and a refresh (a new seed) brings a different one. Finally no reciter appears twice
 * in a row where it can be helped.
 */

export interface ForYouCandidate {
  id: string
  userUsername: string
  likeCount: number
  playCount: number
  createdAt: Date
}

/** How many recitations are drawn from: the newest, together with the most loved of all time. */
export const FOR_YOU_NEWEST = 300
export const FOR_YOU_LOVED = 150

/** A recitation this many days old counts half as "new" as one posted today. */
const NEW_HALF_LIFE_DAYS = 10

/** mulberry32: a small, good-enough PRNG, so a seed always gives the same draw. */
function random(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function weight(c: ForYouCandidate, now: number): number {
  const days = Math.max(0, (now - c.createdAt.getTime()) / 86_400_000)
  const freshness = Math.pow(0.5, days / NEW_HALF_LIFE_DAYS)
  // Logarithms, so a hundred likes count for more than ten, but not ten times more.
  const liked = Math.log1p(c.likeCount) * 1.6
  const played = Math.log1p(c.playCount) * 0.6
  // Everything keeps a floor, so even an unheard recitation can come up.
  return 1 + liked + played + 3 * freshness
}

/** The candidates' ids in For You order for this seed. */
export function forYouOrder(candidates: ForYouCandidate[], seed: string, now = Date.now()): string[] {
  const next = random(seed)
  const drawn = candidates
    .map((c) => ({ c, key: Math.pow(Math.max(next(), 1e-12), 1 / weight(c, now)) }))
    .sort((a, b) => b.key - a.key)
    .map((d) => d.c)

  // The same reciter twice running is pushed back by one or two, where something else can go between.
  const order: ForYouCandidate[] = []
  const waiting = [...drawn]
  while (waiting.length) {
    const last = order[order.length - 1]?.userUsername
    const at = waiting.findIndex((c, i) => c.userUsername !== last || i >= 3)
    order.push(waiting.splice(at === -1 ? 0 : at, 1)[0])
  }
  return order.map((c) => c.id)
}
