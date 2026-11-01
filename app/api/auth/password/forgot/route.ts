import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EMAIL_RULE, normalizeEmail } from '@/lib/email-address'
import { canSendEmail, sendEmail } from '@/lib/email'
import { resetPasswordEmail } from '@/lib/reset-password-email'

export const runtime = 'nodejs'

/** How long a reset link works. */
const LINK_MINUTES = 30
/** One email per address per this long, however often the button is pressed. */
const RESEND_SECONDS = 60

/**
 * POST /api/auth/password/forgot { email }
 *
 * Emails a one-time link to set a new password. The reply is the same whether
 * or not the address has an account, so the form can't be used to find out
 * who uses the app.
 */
export async function POST(req: Request) {
  let body: { email?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const email = normalizeEmail(body.email)
  if (!EMAIL_RULE.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  if (!canSendEmail()) {
    return NextResponse.json({ error: 'Password reset by email is not available yet.' }, { status: 503 })
  }

  try {
    const user = await prisma.user.findFirst({ where: { email }, select: { id: true, name: true, resetSentAt: true } })
    const recently = user?.resetSentAt && Date.now() - user.resetSentAt.getTime() < RESEND_SECONDS * 1000
    if (user && !recently) {
      const token = randomBytes(32).toString('base64url')
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: createHash('sha256').update(token).digest('hex'),
          resetTokenExpires: new Date(Date.now() + LINK_MINUTES * 60000),
          resetSentAt: new Date(),
        },
      })
      const origin = process.env.APP_URL?.trim().replace(/\/$/, '') || new URL(req.url).origin
      const link = `${origin}/reset-password?email=${encodeURIComponent(email)}&token=${token}`
      await sendEmail({ to: email, ...resetPasswordEmail({ name: user.name, link, minutes: LINK_MINUTES, origin }) })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth] reset email failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
