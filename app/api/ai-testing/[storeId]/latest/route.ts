import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readAgentStatuses, type AgentStatusEntry } from '@/lib/agent-queue'
import { getAiTestingRunRoot, getAiTestingRoot, getExtensionAnalyzerRoot } from '@/lib/extension-storage'

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

function newestDirectory(parent: string) {
  if (!fs.existsSync(parent)) return null
  const dirs = fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(parent, entry.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return dirs[0] ?? null
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
    const recordingsPath = status.recordingsPath || path.join(getAiTestingRunRoot(status.id, status.version, resolvedRunId), 'recordings.json')
    const records = parseRecordingSteps(recordingsPath)
    if (records) {
      return { status, records, version: status.version, runId: resolvedRunId }
    }
  }

  return null
}

function findRecordingFromArtifacts(storeId: string, version?: string, runId?: string) {
  const storeRoot = path.join(getExtensionAnalyzerRoot(), storeId)
  const unpackVersionDir = version ? path.join(storeRoot, version) : newestDirectory(storeRoot)
  if (!unpackVersionDir || !fs.existsSync(unpackVersionDir)) return null

  const resolvedVersion = version || path.basename(unpackVersionDir)
  const aiTestingRoot = getAiTestingRoot(storeId, resolvedVersion)
  const runDir = runId ? getAiTestingRunRoot(storeId, resolvedVersion, runId) : newestDirectory(aiTestingRoot)
  if (!runDir) return null

  const resolvedRunId = runId || path.basename(runDir)
  const records = parseRecordingSteps(path.join(runDir, 'recordings.json'))
  if (!records) return null
  return { status: null as AgentStatusEntry | null, records, version: resolvedVersion, runId: resolvedRunId }
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
    select: { version: true },
  })
  const preferredVersion = version || ext?.version || undefined
  const found =
    findRecordingFromStatus(storeId, preferredVersion, runId) ||
    findRecordingFromArtifacts(storeId, preferredVersion, runId) ||
    findRecordingFromStatus(storeId, undefined, runId) ||
    findRecordingFromArtifacts(storeId, undefined, runId)

  if (!found) {
    return NextResponse.json({ error: 'No AI testing record found' }, { status: 404 })
  }

  return NextResponse.json({
    records: found.records,
    status: found.status?.status ?? null,
    statusTime: found.status?.status_time ?? null,
    version: found.version,
    runId: found.runId,
    assetBaseUrl: `/api/ai-testing/${encodeURIComponent(storeId)}/asset/${encodeURIComponent(found.version)}/${encodeURIComponent(found.runId)}`,
  })
}
