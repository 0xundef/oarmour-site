import { createTransport, Transporter } from 'nodemailer'

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

function riskBadgeColor(level: string): { bg: string; fg: string } {
  if (level === 'HIGH' || level === 'CRITICAL') return { bg: '#fee2e2', fg: '#dc2626' }
  if (level === 'CAUTION') return { bg: '#fef3c7', fg: '#d97706' }
  return { bg: '#dcfce7', fg: '#16a34a' }
}

function buildRiskSummary(level: string, fallback: string): string {
  const normalized = (level || 'UNKNOWN').toUpperCase()
  if (normalized === 'SAFE') return 'Risk SAFE. No malicious indicators detected.'
  if (normalized === 'CAUTION') return 'Risk CAUTION. Review recommended.'
  if (normalized === 'HIGH' || normalized === 'CRITICAL') return `Risk ${normalized}. Action needed now.`
  return fallback && fallback.trim().length > 0
    ? `Risk ${normalized}. ${fallback.trim()}`
    : `Risk ${normalized}. Review recommended.`
}

function buildMaliciousAlertHtml(props: {
  extensionName: string
  extensionId: string
  riskLevel: string
  detectedAt: Date
  summary: string
  maliciousDomains?: string[]
  viewReportUrl: string
  unsubscribeUrl: string
}): string {
  const { extensionName, extensionId, riskLevel, detectedAt, summary, maliciousDomains, viewReportUrl, unsubscribeUrl } = props
  const { bg, fg } = riskBadgeColor(riskLevel)
  const chromeWebStoreUrl = `https://chromewebstore.google.com/detail/${encodeURIComponent(extensionId)}`
  const summaryText = buildRiskSummary(riskLevel, summary)

  const domainsHtml =
    maliciousDomains && maliciousDomains.length > 0
      ? `<p style="margin:0 0 16px">Malicious domains found: <code>${maliciousDomains.map(esc).join(', ')}</code></p>`
      : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;background:#f4f4f5;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table align="center" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse">
  <tr>
    <td style="background:#1e293b;color:#fff;padding:24px;border-radius:8px 8px 0 0;font-size:20px;font-weight:bold">⚠️ OArmour Security Alert</td>
  </tr>
  <tr>
    <td style="background:#fff;padding:32px 24px;color:#1e293b;font-size:16px;line-height:1.6">
      <p style="margin:0 0 16px">We detected malicious activity in a web extension you are monitoring.</p>
      <table width="100%" style="border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:6px">
        <tr>
          <td style="padding:8px 12px;font-weight:bold;width:140px">Extension:</td>
          <td style="padding:8px 12px">
            <a href="${esc(chromeWebStoreUrl)}" style="color:#2563eb;text-decoration:underline">${esc(extensionName)}</a>
          </td>
        </tr>
        <tr><td style="padding:8px 12px;font-weight:bold">Risk Level:</td><td style="padding:8px 12px"><span style="background:${bg};color:${fg};padding:2px 8px;border-radius:4px;font-weight:bold;font-size:13px">${esc(riskLevel)}</span></td></tr>
        <tr><td style="padding:8px 12px;font-weight:bold">Detected at:</td><td style="padding:8px 12px">${detectedAt.toUTCString()}</td></tr>
      </table>
      <p style="margin:0 0 8px;font-weight:bold">Summary:</p>
      <p style="margin:0 0 16px">${esc(summaryText)}</p>
      ${domainsHtml}
      <a href="${esc(viewReportUrl)}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">View Full Report →</a>
    </td>
  </tr>
  <tr>
    <td style="background:#fff;padding:16px 24px 24px;color:#94a3b8;font-size:12px;text-align:center">
      <p style="margin:0 0 4px">You are receiving this email because you subscribed to security alerts for this extension.</p>
      <a href="${esc(unsubscribeUrl)}" style="color:#3b82f6;text-decoration:underline">Unsubscribe</a>
    </td>
  </tr>
</table>
</body>
</html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function sendMaliciousAlertEmail(
  to: string,
  props: {
    extensionName: string
    extensionId: string
    riskLevel: string
    detectedAt: Date
    summary: string
    maliciousDomains?: string[]
    viewReportUrl: string
    unsubscribeUrl: string
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = getTransporter()
    const from = process.env.EMAIL_FROM || 'alerts@oarmour.com'
    const html = buildMaliciousAlertHtml(props)

    await t.sendMail({
      from,
      to,
      subject: `⚠️ OArmour Security Alert: Malicious Detection on "${props.extensionName}"`,
      html,
    })

    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[email] Failed to send malicious alert:', msg)
    return { ok: false, error: msg }
  }
}
