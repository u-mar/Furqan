import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { APP_NAME } from '@/lib/app-brand'
import { EMAIL_RULE, normalizeEmail } from '@/lib/email-address'
import { canSendEmail, sendEmail } from '@/lib/email'

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
      await sendEmail({ to: email, ...resetMessage(user.name, link) })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth] reset email failed:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

function resetMessage(name: string, link: string) {
  const first = name.split(' ')[0] || 'there'
  const subject = `Reset your ${APP_NAME} password`
  const text = `Assalamu alaikum ${first},\n\nTap the link below to choose a new password for ${APP_NAME}. It works for ${LINK_MINUTES} minutes.\n\n${link}\n\nIf you didn't ask for this, you can ignore this email; your password stays the same.`
  const html = `<!doctype html><html><body style="margin:0;background:#f4f1e8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1a16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#fffdf8;border-radius:18px;padding:32px 28px">
<tr><td style="font-size:22px;font-weight:700;padding-bottom:6px">${APP_NAME}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;padding-bottom:22px">Assalamu alaikum ${escapeHtml(first)},<br><br>Tap the button below to choose a new password. The link works for ${LINK_MINUTES} minutes.</td></tr>
<tr><td style="padding-bottom:22px"><a href="${link}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 22px;border-radius:10px">Reset password</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#6a675e">If you didn't ask for this, ignore this email; your password stays the same.</td></tr>
</table></td></tr></table></body></html>`
  return { subject, text, html }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
