import { createTransport, Transporter } from 'nodemailer'
import { logError } from '@/lib/app-logger'

let transporter: Transporter | null = null

function getTransporter() {
  if (transporter) return transporter

  if (process.env.RESEND_API_KEY) {
    transporter = createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    })
    return transporter
  }

  const smtpHost =
    process.env.SMTP_HOST ||
    process.env.SMTP_SERVER ||
    process.env.EMAIL_HOST ||
    process.env.IMAP_SERVER
  if (smtpHost) {
    const smtpUser =
      process.env.SMTP_USER ||
      process.env.SMTP_USERNAME ||
      process.env.EMAIL_USER ||
      process.env.IMAP_USERNAME
    const smtpPass =
      process.env.SMTP_PASS ||
      process.env.SMTP_PASSWORD ||
      process.env.EMAIL_PASSWORD ||
      process.env.IMAP_PASSWORD
    const smtpPortRaw = process.env.SMTP_PORT || process.env.EMAIL_PORT || '587'
    const smtpSecureRaw = process.env.SMTP_SECURE || process.env.EMAIL_SECURE
    transporter = createTransport({
      host: smtpHost,
      port: parseInt(smtpPortRaw),
      secure: smtpSecureRaw ? smtpSecureRaw === 'true' : smtpPortRaw === '465',
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })
    return transporter
  }

  transporter = createTransport({
    host: 'localhost',
    port: 1025,
    secure: false,
  })
  return transporter
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function buildRegisterVerificationHtml(props: {
  verifyUrl: string
  expiresMinutes: number
  name?: string
}): string {
  const greeting = props.name ? `Hi ${esc(props.name)},` : "Hi,"
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table align="center" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse">
  <tr>
    <td style="background:#0f172a;color:#fff;padding:24px;border-radius:8px 8px 0 0;font-size:20px;font-weight:bold">Confirm Your Registration</td>
  </tr>
  <tr>
    <td style="background:#fff;padding:32px 24px;color:#1e293b;font-size:16px;line-height:1.6">
      <p style="margin:0 0 16px">${greeting}</p>
      <p style="margin:0 0 16px">Please confirm your email address to finish creating your account.</p>
      <p style="margin:0 0 24px">This verification link expires in <strong>${props.expiresMinutes} minutes</strong>.</p>
      <a href="${esc(props.verifyUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">Verify Email</a>
      <p style="margin:24px 0 0;color:#64748b;font-size:13px;word-break:break-all">If the button does not work, copy and open this link:<br/>${esc(props.verifyUrl)}</p>
    </td>
  </tr>
</table>
</body>
</html>`
}

export async function sendRegistrationVerificationEmail(
  to: string,
  props: {
    verifyUrl: string
    expiresMinutes: number
    name?: string
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = getTransporter()
    const from = process.env.EMAIL_FROM || 'no-reply@localhost'
    const html = buildRegisterVerificationHtml(props)

    await t.sendMail({
      from,
      to,
      subject: 'Verify your account email',
      html,
    })

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logError('[email] failed to send registration verification email', { error: msg })
    return { ok: false, error: msg }
  }
}
