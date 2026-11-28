import { prisma } from '@/lib/prisma'

/**
 * A Listen qari's own Qari account carries the verified badge: the admin verifying a reciter for
 * Listen verifies them on Qari too. Linking the account later does the same; unlinking leaves it.
 */
export async function verifyLinkedAccount(username: string): Promise<void> {
  await prisma.user.updateMany({ where: { username, NOT: { verified: true } }, data: { verified: true, verifyRequestedAt: null, verifyNote: null } })
}
