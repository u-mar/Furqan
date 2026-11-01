import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { SUPPORT_EMAIL } from '@/lib/app-brand'
import { canSendFcm, sendFcm } from '@/lib/fcm'
import { isAppLanguage, type AppLanguage } from '@/lib/i18n-core'

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
 *
 * The Play Store app has no web push: its addresses are "fcm:<token>", sent
 * through Firebase instead (lib/fcm.ts), each kind only once its keys are set.
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
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${SUPPORT_EMAIL}`, publicKey, privateKey)
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

interface Subscribed {
  endpoint: string
  p256dh: string
  auth: string
}

/** Whether anything can be sent at all: web push, Firebase, or both. */
function anyReady(): boolean {
  return configure() || canSendFcm()
}

/** Sends to a batch of phones, forgetting any that answer "gone". Never throws. */
async function deliver(subscriptions: Subscribed[], message: PushMessage, forget: (endpoint: string) => Promise<unknown>): Promise<void> {
  await Promise.all(
    subscriptions.map(async (s) => {
      if (s.endpoint.startsWith('fcm:')) {
        if (!canSendFcm()) return
        try {
          if ((await sendFcm(s.endpoint.slice(4), message)) === 'gone') await forget(s.endpoint).catch(() => {})
        } catch (err) {
          console.error('[push] app send failed:', err)
        }
        return
      }
      if (!configure()) return
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60 * 24 }
        )
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await forget(s.endpoint).catch(() => {})
        } else {
          console.error('[push] send failed:', status ?? err)
        }
      }
    })
  )
}

/**
 * Tell every phone this person has signed in on. Never throws: a message that
 * cannot be sent must not undo what it was about. A phone that has removed the
 * app or turned notifications off answers 404 or 410, and is forgotten.
 */
export async function sendPush(username: string, message: PushMessage): Promise<void> {
  if (!anyReady()) return
  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { username: username.toLowerCase() } })
    await deliver(subscriptions, message, (endpoint) => prisma.pushSubscription.deleteMany({ where: { endpoint } }))
  } catch (err) {
    console.error('[push] failed:', err)
  }
}

/**
 * Tell the given halaqa members — everyone found is sent to, so callers should
 * already have filtered out whoever should not hear about this. Same rules as
 * sendPush, keyed by `memberKey` instead of a username since halaqa people have
 * no account. Given a function, each phone gets the message in the language it
 * uses Naba in.
 */
export async function sendHalaqaPush(
  memberKeys: string[],
  message: PushMessage | ((language: AppLanguage) => PushMessage)
): Promise<void> {
  if (!anyReady() || !memberKeys.length) return
  try {
    const subscriptions = await prisma.halaqaPushSubscription.findMany({ where: { memberKey: { in: memberKeys } } })
    const forget = (endpoint: string) => prisma.halaqaPushSubscription.deleteMany({ where: { endpoint } })
    if (typeof message !== 'function') {
      await deliver(subscriptions, message, forget)
      return
    }
    const byLanguage = new Map<AppLanguage, typeof subscriptions>()
    for (const s of subscriptions) {
      const language = isAppLanguage(s.language) ? s.language : 'en'
      byLanguage.set(language, [...(byLanguage.get(language) ?? []), s])
    }
    await Promise.all([...byLanguage].map(([language, group]) => deliver(group, message(language), forget)))
  } catch (err) {
    console.error('[push] halaqa failed:', err)
  }
}
