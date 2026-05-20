import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import type { JobStatus, RiskLevel } from '@prisma/client'
import { readAgentStatuses } from '@/lib/agent-queue'
import { extractRuntimeApexDomainsWithProvenance } from '@/lib/ai-testing-domains'
import { parseNetworkLogFile } from '@/lib/ai-testing-network'
import { diffNovelApexDomains, normalizeStoredDomainList } from '@/lib/domain-normalize'
import {
  applyVtToAiDomains,
  enrichApexDomains,
  persistAiDomainEnrichments,
  riskLevelFromVtSignals,
  vtSignalsForYoungestDomains,
  type DomainEnrichmentRow,
} from '@/lib/domain-enrichment'
import { getAiTestingRunRoot, getExtensionAnalysisDir } from '@/lib/extension-storage'

const nowIso = () => new Date().toISOString()

const logInfo = (message: string, payload?: unknown) => {
  if (typeof payload === 'undefined') {
    console.warn(`${nowIso()} ${message}`)
    return
  }
  console.warn(`${nowIso()} ${message}`, payload)
}

const logError = (message: string, payload?: unknown) => {
  if (typeof payload === 'undefined') {
    console.error(`${nowIso()} ${message}`)
    return
  }
  console.error(`${nowIso()} ${message}`, payload)
}

const isDatabaseUnavailableError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: unknown }).code
  if (code === 'P1001') return true
  const message = (error as { message?: unknown }).message
  return typeof message === 'string' && message.includes("Can't reach database server")
}

let lastDbUnavailableAiLogAt = 0

export async function resolveStaticAnalysisForBatch(params: {
  extensionDbId: string
  completedBefore?: Date
}) {
  const completedBefore = params.completedBefore ?? new Date()
  return prisma.extensionAnalysisResult.findFirst({
    where: {
      extensionId: params.extensionDbId,
      status: 'COMPLETED',
      updatedAt: { lte: completedBefore },
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, domains: true, updatedAt: true },
  })
}

export async function runAiAnalysisFromNetwork(params: {
  extensionDbId: string
  storeId: string
  version: string
  runId: string
  staticAnalysisId: string
  staticDomains: string[]
}) {
  const networkPath = path.join(
    getAiTestingRunRoot(params.storeId, params.version, params.runId),
    'network.json',
  )
  const network = parseNetworkLogFile(networkPath)
  if (!network) {
    throw new Error(`network.json missing or invalid for run ${params.runId}`)
  }

  const { domains: runtimeDomains, provenance: runtimeProvenance } =
    extractRuntimeApexDomainsWithProvenance(network)
  const novelDomains = diffNovelApexDomains(runtimeDomains, params.staticDomains)

  const existing = await prisma.aiExtensionAnalysisResult.findUnique({
    where: {
      extensionId_runId: {
        extensionId: params.extensionDbId,
        runId: params.runId,
      },
    },
    select: { id: true, status: true },
  })
  if (existing?.status === 'COMPLETED') {
    return { analysisId: existing.id, skipped: true as const, reason: 'already_completed' as const }
  }

  const capturedAt = network.capturedAt ? new Date(network.capturedAt) : null
  const analysis =
    existing ??
    (await prisma.aiExtensionAnalysisResult.create({
      data: {
        extensionId: params.extensionDbId,
        staticAnalysisId: params.staticAnalysisId,
        storeId: params.storeId,
        version: params.version,
        runId: params.runId,
        status: novelDomains.length > 0 ? 'RUNNING' : 'COMPLETED',
        runtimeDomains,
        novelDomains,
        networkRequestCount: network.requestCount,
        networkCapturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null,
        riskLevel: novelDomains.length > 0 ? null : 'SAFE',
      },
      select: { id: true },
    }))

  if (existing) {
    await prisma.aiExtensionAnalysisResult.update({
      where: { id: analysis.id },
      data: {
        status: novelDomains.length > 0 ? 'RUNNING' : 'COMPLETED',
        runtimeDomains,
        novelDomains,
        networkRequestCount: network.requestCount,
        networkCapturedAt: capturedAt && !Number.isNaN(capturedAt.getTime()) ? capturedAt : null,
        staticAnalysisId: params.staticAnalysisId,
        updatedAt: new Date(),
      },
    })
  }

  const analysisDir = getExtensionAnalysisDir(params.storeId, params.version)
  fs.mkdirSync(analysisDir, { recursive: true })
  fs.writeFileSync(
    path.join(analysisDir, `ai_runtime_domains_${params.runId}.json`),
    `${JSON.stringify(
      {
        runtimeDomains,
        novelDomains,
        staticAnalysisId: params.staticAnalysisId,
        domainProvenance: runtimeProvenance,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  if (novelDomains.length === 0) {
    logInfo('[ai-analysis] no novel runtime domains', {
      storeId: params.storeId,
      runId: params.runId,
      runtimeCount: runtimeDomains.length,
    })
    return { analysisId: analysis.id, skipped: false as const, novelCount: 0 }
  }

  logInfo('[ai-analysis] enriching novel runtime domains', {
    storeId: params.storeId,
    runId: params.runId,
    novelCount: novelDomains.length,
  })

  const enrichments = await enrichApexDomains(novelDomains)
  await prisma.aiDomainEnrichment.deleteMany({ where: { analysisId: analysis.id } })
  await persistAiDomainEnrichments(analysis.id, enrichments)

  const enrichmentByDomain = new Map<string, DomainEnrichmentRow>(
    enrichments.map((row) => [row.domain, row]),
  )
  const vtSignals = await vtSignalsForYoungestDomains(novelDomains, enrichmentByDomain)
  await applyVtToAiDomains(analysis.id, vtSignals)
  const riskLevel: RiskLevel = riskLevelFromVtSignals(vtSignals)

  await prisma.aiExtensionAnalysisResult.update({
    where: { id: analysis.id },
    data: {
      status: 'COMPLETED',
      riskLevel,
      updatedAt: new Date(),
    },
  })

  if (riskLevel === 'HIGH') {
    const ext = await prisma.globalExtension.findUnique({
      where: { id: params.extensionDbId },
      select: { name: true, riskLevel: true },
    })
    if (ext && ext.riskLevel !== 'HIGH') {
      await prisma.globalExtension.update({
        where: { id: params.extensionDbId },
        data: { riskLevel: 'HIGH' },
      })
    }
  }

  logInfo('[ai-analysis] completed', {
    analysisId: analysis.id,
    storeId: params.storeId,
    runId: params.runId,
    novelCount: novelDomains.length,
    riskLevel,
  })

  return { analysisId: analysis.id, skipped: false as const, novelCount: novelDomains.length, riskLevel }
}

export async function processCompletedAiTestingRuns() {
  const statuses = readAgentStatuses().filter((s) => s.status === 'complete' && s.runId && s.id && s.version)
  if (statuses.length === 0) {
    return { processed: 0 }
  }

  let processed = 0
  for (const entry of statuses) {
    const storeId = entry.id
    const version = entry.version
    const runId = entry.runId!
    try {
      const extension = await prisma.globalExtension.findUnique({
        where: { storeId },
        select: { id: true, version: true },
      })
      if (!extension) continue

      const already = await prisma.aiExtensionAnalysisResult.findUnique({
        where: { extensionId_runId: { extensionId: extension.id, runId } },
        select: { status: true },
      })
      if (already?.status === 'COMPLETED') {
        continue
      }

      const completedBefore = entry.status_time ? new Date(entry.status_time) : new Date()
      const staticAnalysis = await resolveStaticAnalysisForBatch({
        extensionDbId: extension.id,
        completedBefore,
      })
      if (!staticAnalysis) {
        logInfo('[ai-analysis] skipped: no completed static analysis', { storeId, version, runId })
        continue
      }

      const recordingsPath = path.join(getAiTestingRunRoot(storeId, version, runId), 'recordings.json')
      if (!fs.existsSync(recordingsPath)) {
        continue
      }

      await runAiAnalysisFromNetwork({
        extensionDbId: extension.id,
        storeId,
        version,
        runId,
        staticAnalysisId: staticAnalysis.id,
        staticDomains: normalizeStoredDomainList(staticAnalysis.domains),
      })
      processed += 1
    } catch (e) {
      logError('[ai-analysis] run failed', { storeId, version, runId, error: e })
    }
  }
  return { processed }
}

export function scheduleAiAnalysisService(periodMs: number) {
  if (process.env.AI_ANALYSIS_ENABLED === '0') {
    return null
  }
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await processCompletedAiTestingRuns()
    } catch (e) {
      if (isDatabaseUnavailableError(e)) {
        const now = Date.now()
        if (now - lastDbUnavailableAiLogAt > 30_000) {
          lastDbUnavailableAiLogAt = now
          logInfo('[ai-analysis] tick skipped: database unavailable')
        }
      } else {
        logError('[ai-analysis] tick failed', e)
      }
    } finally {
      running = false
    }
  }
  tick()
  return setInterval(tick, periodMs)
}
