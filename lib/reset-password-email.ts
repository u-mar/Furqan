import { APP_NAME } from '@/lib/app-brand'

/**
 * The "choose a new password" email (app/api/auth/password/forgot). Mail apps
 * understand little more than tables and inline styles, so it is built from
 * those: a centred card with the logo, one button, and the link written out
 * under it for a mail app that will not show the button.
 */

const PAGE = '#eef1ef'
const CARD = '#ffffff'
const RULE = '#e3e8e5'
const INK = '#1b201e'
const TEXT = '#3b4440'
const MUTED = '#6b736f'
const EMERALD = '#0e3a35'
const LINK = '#0f7a6a'
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export function resetPasswordEmail(opts: {
  name: string
  link: string
  minutes: number
  /** Where the logo is served from: the site itself. */
  origin: string
}): { subject: string; text: string; html: string } {
  const first = opts.name.split(' ')[0] || ''
  const subject = `Reset your ${APP_NAME} password`
  const greeting = first ? `Assalamu alaikum ${first},` : 'Assalamu alaikum,'
  const lead = `Someone asked to reset the password for your ${APP_NAME} account. Tap the button below to choose a new one.`
  const expiry = `This link works for ${opts.minutes} minutes.`
  const ignore = "Didn't ask for this? Ignore this email; your password stays the same."

  const text = [greeting, '', lead, '', opts.link, '', expiry, '', ignore, '', `${APP_NAME} · qurannaba.com`].join('\n')

  const e = escapeHtml
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Choose a new password. ${e(expiry)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE}">
<tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" style="max-width:480px;margin:0 auto">
    <tr><td align="center" style="padding-bottom:20px">
      <img src="${e(opts.origin)}/icons/icon-192" width="52" height="52" alt="${e(APP_NAME)}" style="display:block;border:0;border-radius:14px">
    </td></tr>
    <tr><td style="background:${CARD};border:1px solid ${RULE};border-radius:20px;padding:36px 32px;font-family:${FONT}">
      <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:600;color:${INK}">Reset your password</h1>
      <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${TEXT}">${e(greeting)}</p>
      <p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:${TEXT}">${e(lead)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">
        <tr><td style="background:${EMERALD};border-radius:999px">
          <a href="${e(opts.link)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px">Choose a new password</a>
        </td></tr>
      </table>
      <p style="margin:0 0 26px;font-size:13px;line-height:1.5;color:${MUTED}">${e(expiry)}</p>
      <div style="height:1px;background:${RULE};margin:0 0 20px;line-height:1px;font-size:1px">&nbsp;</div>
      <p style="margin:0 0 6px;font-size:12.5px;line-height:1.5;color:${MUTED}">Button not working? Copy this link into your browser:</p>
      <p style="margin:0;font-size:12.5px;line-height:1.5;word-break:break-all"><a href="${e(opts.link)}" target="_blank" style="color:${LINK};text-decoration:underline">${e(opts.link)}</a></p>
    </td></tr>
    <tr><td style="padding:22px 12px 0;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${MUTED};text-align:center">
      ${e(ignore)}<br><br>
      <a href="https://qurannaba.com" target="_blank" style="color:${MUTED};text-decoration:none">${e(APP_NAME)} · qurannaba.com</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
  return { subject, text, html }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
