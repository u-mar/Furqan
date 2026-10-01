import { prisma } from '@/lib/prisma'

/** The usernames this viewer has blocked (lower-case). Empty without a viewer. */
export async function blockedUsernamesFor(viewerId: string | null | undefined): Promise<string[]> {
  if (!viewerId) return []
  const rows = await prisma.qariBlock.findMany({ where: { blockerId: viewerId }, select: { blockedUsername: true } })
  return rows.map((r) => r.blockedUsername)
}

/** Whether `blockerUsername` has blocked `blockedUsername`. */
export async function hasBlocked(blockerUsername: string, blockedUsername: string): Promise<boolean> {
  const row = await prisma.qariBlock.findFirst({ where: { blockerUsername, blockedUsername }, select: { id: true } })
  return Boolean(row)
}
