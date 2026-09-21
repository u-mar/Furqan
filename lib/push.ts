import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

/**
 * Sending a notification to a phone that has the app closed, through the web's
 * push service (Google's on Android, Apple's on iPhones that have the app on
 * their home screen). The phone's address is a "subscription" the app saved when
 * the person said yes; it is only ever used to tell them about their own
 * recitations and followers.
 *
 * Keys: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT
 * (a mailto: address people can reach you on). Without them nothing is sent
 * and nothing breaks.
 */

let ready: boolean | null = null

function configure(): boolean {
  if (ready !== null) return ready
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    ready = false
    return false
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@example.com', publicKey, privateKey)
  ready = true
  return true
}

export interface PushMessage {
  title: string
  body: string
  /** Where tapping it goes, inside the app. */
  url: string
  /** A newer message with the same tag replaces the older one on the phone. */
  tag?: string
}

/**
 * Tell every phone this person has signed in on. Never throws: a message that
 * cannot be sent must not undo what it was about. A phone that has removed the
 * app or turned notifications off answers 404 or 410, and is forgotten.
 */
export async function sendPush(username: string, message: PushMessage): Promise<void> {
  if (!configure()) return
  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { username: username.toLowerCase() } })
    await Promise.all(
      subscriptions.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(message),
            { TTL: 60 * 60 * 24 }
          )
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => {})
          } else {
            console.error('[push] send failed:', status ?? err)
          }
        }
      })
    )
  } catch (err) {
    console.error('[push] failed:', err)
  }
}
