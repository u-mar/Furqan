import { isAdminRequestAuthenticated } from '@/lib/admin-auth-server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

/**
 * Whether this caller may post a recording made outside the app: an account the
 * admin has approved, or the admin. Fails closed if the account cannot be read.
 */
export async function mayUploadRecordings(req: Request, username: string, userId: string): Promise<boolean> {
  if (await isAdminRequestAuthenticated(req)) return true
  if (!(await ownsUsername(username, userId))) return false
  try {
    const account = await prisma.user.findUnique({ where: { username }, select: { canUpload: true } })
    return account?.canUpload === true
  } catch {
    return false
  }
}
