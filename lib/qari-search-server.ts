import { matchScore, normalizeText } from '@/lib/fuzzy-match'
import { prisma } from '@/lib/prisma'

/**
 * Qari's search, done on the server over a slim list of every public recitation: close matches
 * count (lib/fuzzy-match.ts), not only the exact letters a database "contains" finds.
 */

/** The newest recitations searched. Far more than Qari holds today; past this the oldest are left out. */
const POOL_SIZE = 4000
/** How long the list is reused before it is read again: new posts show in searches within this. */
const POOL_MS = 60_000

interface PoolItem {
  id: string
  title: string | null
  userName: string
  userUsername: string
  hashtags: string[]
  likeCount: number
  imitating: string | null
}

let pool: { at: number; items: Promise<PoolItem[]> } | null = null

function searchPool(): Promise<PoolItem[]> {
  if (pool && Date.now() - pool.at < POOL_MS) return pool.items
  const items = prisma.recitation
    .findMany({
      where: { hidden: false, isPrivate: false },
      select: { id: true, title: true, userName: true, userUsername: true, hashtags: true, likeCount: true, imitating: true },
      orderBy: { createdAt: 'desc' },
      take: POOL_SIZE,
    })
    .catch((err) => {
      pool = null
      throw err
    })
  pool = { at: Date.now(), items }
  return items
}

function fieldsOf(item: PoolItem) {
  return [
    { text: item.userName, weight: 1 },
    { text: item.userUsername, weight: 1 },
    { text: item.title ?? '', weight: 0.95 },
    { text: item.hashtags.join(' '), weight: 0.85 },
  ]
}

/** Ranks by how well each matches, then by how loved it is. */
const rank = (score: number, likes: number) => score * 100 + Math.log10(likes + 1) * 4

/**
 * The ids of the public recitations a search finds, best first. `sheikhId` adds everything
 * imitating that sheikh, when the search names one. People in `blocked` are left out.
 */
export async function searchRecitationIds(query: string, options: { blocked: string[]; sheikhId?: string | null }): Promise<string[]> {
  const blocked = new Set(options.blocked.map((u) => u.toLowerCase()))
  const scored: { id: string; value: number }[] = []
  for (const item of await searchPool()) {
    if (blocked.has(item.userUsername.toLowerCase())) continue
    let score = matchScore(query, fieldsOf(item))
    if (options.sheikhId && item.imitating === options.sheikhId) score = Math.max(score, 0.9)
    if (score > 0) scored.push({ id: item.id, value: rank(score, item.likeCount) })
  }
  return scored.sort((a, b) => b.value - a.value).map((s) => s.id)
}

export interface SearchSuggestions {
  /** Reciters whose name or handle matches, most loved first among equals. */
  qaris: { username: string; name: string }[]
  /** Searches to offer: recitation titles and #tags that match. */
  terms: string[]
}

/** What to suggest while someone types, as TikTok does: reciters, then searches. */
export async function suggestFor(query: string, blocked: string[]): Promise<SearchSuggestions> {
  const typed = normalizeText(query)
  if (!typed) return { qaris: [], terms: [] }
  const hidden = new Set(blocked.map((u) => u.toLowerCase()))

  const qaris = new Map<string, { username: string; name: string; value: number }>()
  const terms = new Map<string, { text: string; value: number }>()
  for (const item of await searchPool()) {
    const username = item.userUsername.toLowerCase()
    if (hidden.has(username)) continue

    const person = matchScore(query, [
      { text: item.userName, weight: 1 },
      { text: item.userUsername, weight: 1 },
    ])
    if (person > 0) {
      const value = rank(person, item.likeCount)
      const seen = qaris.get(username)
      // A reciter counts once, by their best-loved recitation.
      if (!seen || value > seen.value) qaris.set(username, { username: item.userUsername, name: item.userName, value })
    }

    if (item.title) {
      const score = matchScore(query, [{ text: item.title, weight: 1 }])
      const key = normalizeText(item.title)
      if (score > 0 && key) {
        const value = rank(score, item.likeCount)
        const seen = terms.get(key)
        if (!seen || value > seen.value) terms.set(key, { text: item.title.trim(), value: (seen?.value ?? 0) + value })
      }
    }
    for (const tag of item.hashtags) {
      const score = matchScore(query.replace(/^#/, ''), [{ text: tag, weight: 1 }])
      if (score <= 0) continue
      const key = `#${tag.toLowerCase()}`
      const seen = terms.get(key)
      terms.set(key, { text: `#${tag}`, value: (seen?.value ?? 0) + rank(score, item.likeCount) })
    }
  }

  return {
    qaris: [...qaris.values()].sort((a, b) => b.value - a.value).slice(0, 3).map(({ username, name }) => ({ username, name })),
    terms: [...terms.values()].sort((a, b) => b.value - a.value).slice(0, 8).map((t) => t.text),
  }
}
