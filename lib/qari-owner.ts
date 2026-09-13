import { prisma } from '@/lib/prisma'

/**
 * Confirm the caller owns the username they are writing to.
 *
 * A database account answers only to its own id. The `local_<username>` form
 * is accepted solely for a username with no account behind it — it is
 * guessable by anyone, so it must never unlock a real account. Checking for
 * the account first is what enforces that; checking the local form first let
 * anyone act as any registered user.
 *
 * Fails closed: if the account cannot be looked up, the answer is no.
 */
export async function ownsUsername(username: string, userId: string): Promise<boolean> {
  if (!username || !userId) return false

  let account: { id: string } | null
  try {
    account = await prisma.user.findUnique({ where: { username }, select: { id: true } })
  } catch {
    return false
  }

  if (account) return account.id === userId
  return userId === `local_${username}`
}
