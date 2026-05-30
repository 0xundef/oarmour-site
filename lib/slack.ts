import { logError, logInfo, logWarn } from '@/lib/app-logger'

const RISK_RANK: Record<string, number> = {
  UNKNOWN: 0,
  SAFE: 1,
  CAUTION: 2,
  HIGH: 3,
  CRITICAL: 4,
}

function normalizeRisk(level: string): string {
  return (level || 'UNKNOWN').toUpperCase()
}

function meetsMinRisk(level: string, minLevel: string): boolean {
  const levelRank = RISK_RANK[normalizeRisk(level)] ?? 0
  const minRank = RISK_RANK[normalizeRisk(minLevel)] ?? RISK_RANK.HIGH
  return levelRank >= minRank
}

function buildRiskSummary(level: string, fallback: string): string {
  const normalized = normalizeRisk(level)
  if (normalized === 'SAFE') return 'Risk SAFE. No malicious indicators detected.'
  if (normalized === 'CAUTION') return 'Risk CAUTION. Review recommended.'
  if (normalized === 'HIGH' || normalized === 'CRITICAL') return `Risk ${normalized}. Action needed now.`
  return fallback.trim().length > 0
    ? `Risk ${normalized}. ${fallback.trim()}`
    : `Risk ${normalized}. Review recommended.`
}

export type MaliciousAlertSlackProps = {
  extensionName: string
  extensionId: string
  riskLevel: string
  detectedAt: Date
  summary: string
  maliciousDomains?: string[]
  viewReportUrl: string
}

export type SlackAlertResult =
  | { ok: true; skipped: false }
  | { ok: false; skipped: false; error: string }
  | { ok: true; skipped: true; reason: 'not_configured' | 'below_min_risk' }

export async function sendMaliciousAlertSlack(
  props: MaliciousAlertSlackProps,
): Promise<SlackAlertResult> {
  const webhookUrl = process.env.SLACK_ALERT_WEBHOOK_URL?.trim()
  if (!webhookUrl) {
    return { ok: true, skipped: true, reason: 'not_configured' }
  }

  const minRisk = process.env.SLACK_ALERT_MIN_RISK?.trim() || 'HIGH'
  if (!meetsMinRisk(props.riskLevel, minRisk)) {
    return { ok: true, skipped: true, reason: 'below_min_risk' }
  }

  const summaryText = buildRiskSummary(props.riskLevel, props.summary)
  const chromeWebStoreUrl = `https://chromewebstore.google.com/detail/${encodeURIComponent(props.extensionId)}`
  const domainsLine =
    props.maliciousDomains && props.maliciousDomains.length > 0
      ? `*Malicious domains:* ${props.maliciousDomains.map((d) => `\`${d}\``).join(', ')}`
      : null

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'OArmour Security Alert', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Malicious or elevated-risk activity detected on a monitored extension.',
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Extension:*\n<${chromeWebStoreUrl}|${props.extensionName}>` },
        { type: 'mrkdwn', text: `*Risk level:*\n*${normalizeRisk(props.riskLevel)}*` },
        { type: 'mrkdwn', text: `*Store ID:*\n\`${props.extensionId}\`` },
        { type: 'mrkdwn', text: `*Detected at:*\n${props.detectedAt.toUTCString()}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Summary:*\n${summaryText}` },
    },
  ]

  if (domainsLine) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: domainsLine },
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View report', emoji: true },
        url: props.viewReportUrl,
        style: 'primary',
      },
    ],
  })

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `OArmour alert: ${props.extensionName} (${normalizeRisk(props.riskLevel)})`,
        blocks,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const error = `Slack webhook HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
      logWarn('[slack] alert webhook failed', { error, extensionId: props.extensionId })
      return { ok: false, skipped: false, error }
    }

    logInfo('[slack] alert sent', { extensionId: props.extensionId, riskLevel: props.riskLevel })
    return { ok: true, skipped: false }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    logError('[slack] alert webhook error', { error, extensionId: props.extensionId })
    return { ok: false, skipped: false, error }
  }
}
