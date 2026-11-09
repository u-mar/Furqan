import { isAdminRequestAuthenticated } from '@/lib/admin-auth-server'
import { prisma } from '@/lib/prisma'
import { ownsUsername } from '@/lib/qari-owner'

/** The row the admin's site-wide settings live in. */
const ADMIN_CONFIG_KEY = 'global'

/** Whether the admin has opened uploading to every account. Closed if it cannot be read. */
export async function uploadsOpenToEveryone(): Promise<boolean> {
  try {
    const config = await prisma.adminConfig.findUnique({ where: { key: ADMIN_CONFIG_KEY }, select: { uploadsOpen: true } })
    return config?.uploadsOpen === true
  } catch {
    return false
  }
}

export async function setUploadsOpenToEveryone(open: boolean): Promise<void> {
  await prisma.adminConfig.upsert({
    where: { key: ADMIN_CONFIG_KEY },
    update: { uploadsOpen: open },
    create: { key: ADMIN_CONFIG_KEY, dailyVerseKey: '2:152', dailyVerseSurah: 'Al-Baqarah', uploadsOpen: open },
  })
}

/**
 * Whether this caller may post a recording made outside the app: any account
 * while the admin has that open, otherwise one the admin has approved; or the
 * admin. Fails closed if the account cannot be read.
 */
export async function mayUploadRecordings(req: Request, username: string, userId: string): Promise<boolean> {
  if (await isAdminRequestAuthenticated(req)) return true
  if (!(await ownsUsername(username, userId))) return false
  if (await uploadsOpenToEveryone()) return true
  try {
    const account = await prisma.user.findUnique({ where: { username }, select: { canUpload: true } })
    return account?.canUpload === true
  } catch {
    return false
  }
}
