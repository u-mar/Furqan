import { prisma } from '@/lib/prisma'

export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

/** Qari pages live at /qari/<name>, so a handle can never be one of these. */
const RESERVED_USERNAMES = new Set(['record', 'qaris', 'sheikh', 'sheikhs', 'admin', 'settings'])

/**
 * A handle is taken if an account holds it — or if a local-only account has
 * already published under it. Those never reach the users table, so checking
 * accounts alone would let someone register the name and inherit another
 * person's recitations and picture.
 */
export async function isUsernameTaken(username: string): Promise<boolean> {
  if (RESERVED_USERNAMES.has(username)) return true
  const [account, recitation, avatar] = await Promise.all([
    prisma.user.findUnique({ where: { username }, select: { id: true } }),
    prisma.recitation.findFirst({ where: { userUsername: username }, select: { id: true } }),
    prisma.qariAvatar.findUnique({ where: { username }, select: { id: true } }),
  ])
  return Boolean(account || recitation || avatar)
}

/**
 * A free handle that looks like the person: from their Google name or email,
 * e.g. "amina.k@gmail.com" → "aminak", with a number added if it is taken.
 */
export async function suggestUsername(name: string | null, email: string | null): Promise<string> {
  const fromEmail = email?.split('@')[0] ?? ''
  const base =
    (fromEmail || name || 'reciter')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 16) || 'reciter'
  const padded = base.length >= 3 ? base : `${base}qari`.slice(0, 16)
  if (!(await isUsernameTaken(padded))) return padded
  for (let i = 0; i < 20; i++) {
    const candidate = `${padded}${Math.floor(10 + Math.random() * 990)}`.slice(0, 20)
    if (!(await isUsernameTaken(candidate))) return candidate
  }
  return `${padded.slice(0, 12)}${Date.now().toString().slice(-6)}`
}
