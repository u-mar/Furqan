import type { Metadata } from 'next'
import JoinHalaqa from '@/components/halaqa/JoinHalaqa'
import { APP_NAME } from '@/lib/app-brand'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ code: string }> }

function cleanCode(code: string): string {
  const lower = code.trim().toLowerCase()
  return /^[a-z0-9]{6,12}$/.test(lower) ? lower : ''
}

/**
 * The invite link is what gets pasted into WhatsApp every day, so its preview
 * names the halaqa rather than just the app.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = cleanCode((await params).code)
  const description = 'Read the Quran together. Tap to join, or to tick off your reading for today.'
  if (code) {
    try {
      const halaqa = await prisma.halaqa.findFirst({ where: { code }, select: { name: true } })
      if (halaqa) {
        const title = `${halaqa.name} · ${APP_NAME}`
        return { title, description, openGraph: { title, description } }
      }
    } catch {
      // Fall back to the plain title below.
    }
  }
  return { title: `Halaqa · ${APP_NAME}`, description }
}

export default async function InviteLinkPage({ params }: Props) {
  const { code } = await params
  return <JoinHalaqa code={cleanCode(code) || code} />
}
