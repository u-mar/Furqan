import type { Metadata } from 'next'
import QariProfile from '@/components/qari/QariProfile'
import { APP_NAME } from '@/lib/app-brand'
import { prisma } from '@/lib/prisma'
import { openGraphFor, recitationPreviewImage } from '@/lib/share-preview'

type Props = {
  params: Promise<{ username: string }>
  searchParams: Promise<{ r?: string | string[] }>
}

/**
 * A shared recitation is a link to its reciter's page (?r=<id>), pasted into
 * WhatsApp and the like: its preview names the recitation and who recited it,
 * over the background it was posted on. Private and removed posts, and people
 * who are not found, get the plain Naba preview, giving nothing away.
 */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const username = decodeURIComponent((await params).username).toLowerCase()
  const r = (await searchParams).r
  const recitationId = typeof r === 'string' && /^[a-f0-9]{24}$/.test(r) ? r : null
  try {
    if (recitationId) {
      const recitation = await prisma.recitation.findUnique({
        where: { id: recitationId },
        select: { id: true, kind: true, imageId: true, background: true, title: true, userName: true, userUsername: true, isPrivate: true, hidden: true },
      })
      if (recitation && !recitation.isPrivate && !recitation.hidden && recitation.userUsername === username) {
        const title = recitation.title ? `${recitation.userName} — ${recitation.title}` : `${recitation.userName} on ${APP_NAME}`
        const description =
          recitation.kind === 'ayah' ? `An ayah card on ${APP_NAME}.` : `Listen to this recitation on ${APP_NAME}.`
        return { title, description, ...openGraphFor({ title, description, image: recitationPreviewImage(recitation) }) }
      }
    }
    const user = await prisma.user.findFirst({ where: { username }, select: { name: true, username: true } })
    if (user) {
      const title = `${user.name} (@${user.username}) · ${APP_NAME}`
      const description = `Recitations by ${user.name} on ${APP_NAME}.`
      return { title, description, ...openGraphFor({ title, description }) }
    }
  } catch {
    // The plain preview below.
  }
  const title = `Qari · ${APP_NAME}`
  const description = `Listen to recitations and share your own on ${APP_NAME}.`
  return { title, description, ...openGraphFor({ title, description }) }
}

export default function QariProfilePage() {
  return <QariProfile />
}
