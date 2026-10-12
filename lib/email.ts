/**
 * Sending email, through Resend (resend.com). Set RESEND_API_KEY, and
 * EMAIL_FROM to an address on a domain verified there, e.g.
 * "Naba <no-reply@nabaquran.app>". Until then nothing is sent.
 */

export function canSendEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return false
  const from = process.env.EMAIL_FROM?.trim() || 'Naba <onboarding@resend.dev>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    })
    if (!res.ok) console.error('[email] Resend refused the message:', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (error) {
    console.error('[email] could not reach Resend:', error)
    return false
  }
}
