import { prisma } from '@/lib/prisma'
import { dropCloudVideo } from '@/lib/qari-cloud-video'
import { removeAudio, removeImage } from '@/lib/qari-storage'

/**
 * Takes a Qari recitation down for good: its audio, picture and share video, its likes and every
 * report against it, then the recitation itself. For the admin (Reports, Recitations).
 */
export async function removeRecitation(recitationId: string): Promise<void> {
  const recitation = await prisma.recitation.findUnique({ where: { id: recitationId } })
  if (recitation) {
    if (recitation.audioId) await removeAudio(recitation.audioId).catch(() => {})
    await dropCloudVideo(recitation, true)
    if (recitation.imageId) await removeImage(recitation.imageId).catch(() => {})
    await prisma.recitationLike.deleteMany({ where: { recitationId } })
  }
  await prisma.recitationReport.deleteMany({ where: { recitationId } })
  await prisma.recitation.delete({ where: { id: recitationId } }).catch(() => {})
}
