import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readAgentStatuses, type AgentStatusEntry } from '@/lib/agent-queue'
import {
  getAiTestingRunRoot,
  listAiTestingRunsWithRecordings,
} from '@/lib/extension-storage'
import { parseNetworkLogFile, type AiTestingNetworkLog } from '@/lib/ai-testing-network'

export const runtime = 'nodejs'

type RecordingStep = {
  time: string
  thinking: string
  image: string
}

function parseRecordingSteps(filePath: string): RecordingStep[] | null {
  if (!fs.existsSync(filePath)) return null
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
  if (!Array.isArray(parsed)) return null
  return parsed.flatMap((item): RecordingStep[] => {
    if (!item || typeof item !== 'object') return []
    const obj = item as Record<string, unknown>
    const time = typeof obj.time === 'string' ? obj.time : ''
    const thinking = typeof obj.thinking === 'string' ? obj.thinking : ''
    const image = typeof obj.image === 'string' ? obj.image : ''
    if (!time || !thinking || !image) return []
    return [{ time, thinking, image }]
  })
}

function matchStatus(
  storeId: string,
  version: string,
  runId: string,
): AgentStatusEntry | null {
  return (
    readAgentStatuses().find(
      (item) =>
        item.id === storeId &&
        item.version === version &&
        (item.runId === runId ||
          (item.index !== undefined && String(item.index) === runId)),
    ) ?? null
  )
}

function loadRunPayload(
  storeId: string,
  version: string,
  runId: string,
  runRoot?: string,
) {
  const root = runRoot ?? getAiTestingRunRoot(storeId, version, runId)
  const records = parseRecordingSteps(path.join(root, 'recordings.json'))
  if (!records) return null
  const network = parseNetworkLogFile(path.join(root, 'network.json'))
  return {
    status: matchStatus(storeId, version, runId),
    records,
    version,
    runId,
    network,
  }
}

/** Prefer newest run on disk under extension-data (recordings + network from same folder). */
function findLatestFromExtensionData(
  storeId: string,
  version?: string,
  runId?: string,
) {
  const runs = listAiTestingRunsWithRecordings(storeId, version)
  if (!runs.length) return null

  const pick = runId ? runs.find((r) => r.runId === runId) : runs[0]
  if (!pick) return null
  return loadRunPayload(storeId, pick.version, pick.runId, pick.runRoot)
}

function findRecordingFromStatus(storeId: string, version?: string, runId?: string) {
  const statuses = readAgentStatuses()
    .filter((item) => item.id === storeId)
    .filter((item) => !version || item.version === version)
    .filter((item) => !runId || item.runId === runId)
    .sort((a, b) => Date.parse(b.status_time || '') - Date.parse(a.status_time || ''))

  for (const status of statuses) {
    const resolvedRunId = status.runId ?? (status.index !== undefined ? String(status.index) : '')
    if (!resolvedRunId) continue
    const runRoot = status.recordingsPath
      ? path.dirname(status.recordingsPath)
      : getAiTestingRunRoot(status.id, status.version, resolvedRunId)
    const loaded = loadRunPayload(status.id, status.version, resolvedRunId, runRoot)
    if (loaded) {
      return { ...loaded, status }
    }
  }

  return null
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await context.params
  const version = req.nextUrl.searchParams.get('version') || undefined
  const runId = req.nextUrl.searchParams.get('runId') || undefined

  if (!storeId) {
    return NextResponse.json({ error: 'storeId required' }, { status: 400 })
  }

  const ext = await prisma.globalExtension.findUnique({
    where: { storeId },
    select: { id: true, version: true },
  })
  const preferredVersion = version || ext?.version || undefined

  const found =
    (runId
      ? findLatestFromExtensionData(storeId, preferredVersion, runId) ||
        findLatestFromExtensionData(storeId, undefined, runId)
      : null) ||
    findLatestFromExtensionData(storeId, preferredVersion, runId) ||
    findLatestFromExtensionData(storeId, undefined, runId) ||
    findRecordingFromStatus(storeId, preferredVersion, runId) ||
    findRecordingFromStatus(storeId, undefined, runId)

  if (!found) {
    return NextResponse.json({ error: 'No AI testing record found' }, { status: 404 })
  }

  const aiAnalysis =
    ext?.id && found.runId
      ? await prisma.aiExtensionAnalysisResult.findUnique({
          where: {
            extensionId_runId: { extensionId: ext.id, runId: found.runId },
          },
          select: {
            id: true,
            status: true,
            error: true,
            staticAnalysisId: true,
            runtimeDomains: true,
            novelDomains: true,
            riskLevel: true,
            networkRequestCount: true,
            networkCapturedAt: true,
            createdAt: true,
            updatedAt: true,
            domainEnrichments: {
              select: {
                domain: true,
                registrar: true,
                status: true,
                nameservers: true,
                createdDate: true,
                expiresDate: true,
                isMalicious: true,
              },
              orderBy: { domain: 'asc' },
            },
          },
        })
      : null

  return NextResponse.json({
    records: found.records,
    network: found.network ?? null,
    aiAnalysis,
    status: found.status?.status ?? null,
    statusTime: found.status?.status_time ?? null,
    version: found.version,
    runId: found.runId,
    assetBaseUrl: `/api/ai-testing/${encodeURIComponent(storeId)}/asset/${encodeURIComponent(found.version)}/${encodeURIComponent(found.runId)}`,
  })
}
