import { prisma } from '@/lib/prisma'

/**
 * Confirm the caller owns the username they are writing to.
 *
 * Accounts come in two shapes: database-backed (the id is the User row's id)
 * and local-only (`local_<username>`, which never reaches the server). Both
 * are accepted, but neither lets one qari act as another.
 */
export async function ownsUsername(username: string, userId: string): Promise<boolean> {
  if (!username || !userId) return false
  if (userId === `local_${username}`) return true
  try {
    const user = await prisma.user.findUnique({ where: { username } })
    return Boolean(user && user.id === userId)
  } catch {
    return false
  }
}
