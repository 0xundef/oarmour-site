import 'server-only'
import fs from 'fs'
import path from 'path'
import { clearAnalyzeProgress } from '@/lib/analyze-progress'
import { prisma } from '@/lib/prisma'
import {
  EXTENSION_SIDE_DATA_DIRNAME,
  getAgentQueueRoot,
  getExtensionAnalyzerRoot,
  getExtensionArtifactRoot,
  getExtensionSidecarRoot,
} from '@/lib/extension-storage'

export type ExtensionVersionListItem = {
  version: string
  hasStaticCompleted: boolean
  hasAi: boolean
  onDisk: boolean
  lastUpdatedAt: string | null
}

function listDiskVersions(storeId: string): string[] {
  const storeDir = path.join(getAgentQueueRoot(), EXTENSION_SIDE_DATA_DIRNAME, storeId)
  if (!fs.existsSync(storeDir)) return []
  return fs
    .readdirSync(storeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name.length > 0)
}

function listAnalyzerDiskVersions(storeId: string): string[] {
  const artifactRoot = path.join(getExtensionAnalyzerRoot(), storeId)
  if (!fs.existsSync(artifactRoot)) return []
  return fs
    .readdirSync(artifactRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name.length > 0)
}

function rmDirIfExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) return
  fs.rmSync(dirPath, { recursive: true, force: true })
}

export async function listExtensionVersions(
  extensionId: string,
  storeId: string,
): Promise<ExtensionVersionListItem[]> {
  const [staticRows, aiRows] = await Promise.all([
    prisma.extensionAnalysisResult.findMany({
      where: { extensionId, version: { not: null } },
      select: { version: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.aiExtensionAnalysisResult.findMany({
      where: { extensionId },
      select: { version: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  const diskVersions = new Set([...listDiskVersions(storeId), ...listAnalyzerDiskVersions(storeId)])
  const byVersion = new Map<string, ExtensionVersionListItem>()

  for (const row of staticRows) {
    const version = row.version?.trim()
    if (!version) continue
    const existing = byVersion.get(version)
    const hasStaticCompleted = row.status === 'COMPLETED' || existing?.hasStaticCompleted === true
    const lastUpdatedAt = row.updatedAt.toISOString()
    byVersion.set(version, {
      version,
      hasStaticCompleted,
      hasAi: existing?.hasAi ?? false,
      onDisk: existing?.onDisk ?? diskVersions.has(version),
      lastUpdatedAt:
        !existing?.lastUpdatedAt || lastUpdatedAt > existing.lastUpdatedAt
          ? lastUpdatedAt
          : existing.lastUpdatedAt,
    })
  }

  for (const row of aiRows) {
    const version = row.version.trim()
    if (!version) continue
    const existing = byVersion.get(version)
    const lastUpdatedAt = row.updatedAt.toISOString()
    byVersion.set(version, {
      version,
      hasStaticCompleted: existing?.hasStaticCompleted ?? false,
      hasAi: true,
      onDisk: existing?.onDisk ?? diskVersions.has(version),
      lastUpdatedAt:
        !existing?.lastUpdatedAt || lastUpdatedAt > existing.lastUpdatedAt
          ? lastUpdatedAt
          : existing.lastUpdatedAt,
    })
  }

  for (const version of diskVersions) {
    if (!byVersion.has(version)) {
      byVersion.set(version, {
        version,
        hasStaticCompleted: false,
        hasAi: false,
        onDisk: true,
        lastUpdatedAt: null,
      })
    } else {
      const item = byVersion.get(version)!
      item.onDisk = true
    }
  }

  return Array.from(byVersion.values()).sort((a, b) => {
    const ta = a.lastUpdatedAt ? Date.parse(a.lastUpdatedAt) : 0
    const tb = b.lastUpdatedAt ? Date.parse(b.lastUpdatedAt) : 0
    return tb - ta
  })
}

async function resolveNextGlobalVersion(extensionId: string, deletedVersion: string) {
  const remaining = await prisma.extensionAnalysisResult.findFirst({
    where: {
      extensionId,
      status: 'COMPLETED',
      version: { not: null, notIn: [deletedVersion] },
    },
    orderBy: { updatedAt: 'desc' },
    select: { version: true },
  })
  return remaining?.version?.trim() || null
}

export async function deleteExtensionVersion(params: {
  extensionId: string
  storeId: string
  version: string
}) {
  const version = params.version.trim()
  if (!version) {
    throw new Error('version is required')
  }

  const staticRows = await prisma.extensionAnalysisResult.findMany({
    where: { extensionId: params.extensionId, version },
    select: { id: true },
  })
  const staticIds = staticRows.map((row) => row.id)

  await prisma.$transaction(async (tx) => {
    await tx.aiExtensionAnalysisResult.deleteMany({
      where: { extensionId: params.extensionId, version },
    })

    if (staticIds.length > 0) {
      await tx.extensionAnalysisResult.deleteMany({
        where: { id: { in: staticIds } },
      })
    }

    await tx.assetSnapshot.deleteMany({
      where: {
        targetType: 'EXTENSION',
        targetId: params.extensionId,
        version,
      },
    })

    const ext = await tx.globalExtension.findUnique({
      where: { id: params.extensionId },
      select: { version: true, pendingVersion: true },
    })
    const data: { version?: string | null; pendingVersion?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    }
    let needsPointerUpdate = false
    if (ext?.version?.trim() === version) {
      data.version = await resolveNextGlobalVersion(params.extensionId, version)
      needsPointerUpdate = true
    }
    if (ext?.pendingVersion?.trim() === version) {
      data.pendingVersion = null
      needsPointerUpdate = true
    }
    if (needsPointerUpdate) {
      await tx.globalExtension.update({
        where: { id: params.extensionId },
        data,
      })
    }
  })

  rmDirIfExists(getExtensionSidecarRoot(params.storeId, version))
  rmDirIfExists(getExtensionArtifactRoot(params.storeId, version))

  const nextPointers = await prisma.globalExtension.findUnique({
    where: { id: params.extensionId },
    select: { version: true, pendingVersion: true },
  })

  return {
    deletedVersion: version,
    nextGlobalVersion: nextPointers?.version?.trim() || null,
    nextPendingVersion: nextPointers?.pendingVersion?.trim() || null,
  }
}

/** Remove `_pending-*` scratch dirs under chrome-extension-analyzer/<storeId>/ only. */
export function removeAnalyzerPendingScratchDirs(storeId: string): string[] {
  const artifactRoot = path.join(getExtensionAnalyzerRoot(), storeId)
  if (!fs.existsSync(artifactRoot)) return []
  const removed: string[] = []
  for (const entry of fs.readdirSync(artifactRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('_pending-')) continue
    const dirPath = path.join(artifactRoot, entry.name)
    rmDirIfExists(dirPath)
    removed.push(dirPath)
  }
  return removed
}

export type ClearPendingHalfStateResult = {
  storeId: string
  clearedPendingVersion: string | null
  detectedVersion: string | null
  deletedScanJobs: number
  deletedInFlightAnalysisRows: number
  removedDiskPaths: string[]
  nextPendingVersion: string | null
}

/**
 * Drops incomplete pending-target work for one extension. Never removes a COMPLETED
 * detected version's artifacts when pending differs from detected.
 */
export async function clearExtensionPendingHalfState(params: {
  extensionId: string
  storeId: string
}): Promise<ClearPendingHalfStateResult> {
  const ext = await prisma.globalExtension.findUnique({
    where: { id: params.extensionId },
    select: { version: true, pendingVersion: true, storeId: true },
  })
  if (!ext) {
    throw new Error('Extension not found')
  }
  if (ext.storeId !== params.storeId) {
    throw new Error('storeId does not match extension')
  }

  const detected = ext.version?.trim() || null
  const pending = ext.pendingVersion?.trim() || null
  const removedDiskPaths: string[] = []

  if (pending && pending !== detected) {
    await deleteExtensionVersion({
      extensionId: params.extensionId,
      storeId: params.storeId,
      version: pending,
    })
    removedDiskPaths.push(
      getExtensionSidecarRoot(params.storeId, pending),
      getExtensionArtifactRoot(params.storeId, pending),
    )
  }

  const { deletedScanJobs, deletedInFlightAnalysisRows } = await prisma.$transaction(async (tx) => {
    const scanResult = await tx.scanJob.deleteMany({
      where: {
        targetType: 'EXTENSION',
        targetId: params.extensionId,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    })

    const analysisResult = await tx.extensionAnalysisResult.deleteMany({
      where: {
        extensionId: params.extensionId,
        status: { in: ['PENDING', 'RUNNING', 'FAILED'] },
      },
    })

    await tx.globalExtension.update({
      where: { id: params.extensionId },
      data: { pendingVersion: null, updatedAt: new Date() },
    })

    return {
      deletedScanJobs: scanResult.count,
      deletedInFlightAnalysisRows: analysisResult.count,
    }
  })

  removedDiskPaths.push(...removeAnalyzerPendingScratchDirs(params.storeId))
  clearAnalyzeProgress(params.storeId)

  const next = await prisma.globalExtension.findUnique({
    where: { id: params.extensionId },
    select: { pendingVersion: true },
  })

  return {
    storeId: params.storeId,
    clearedPendingVersion: pending,
    detectedVersion: detected,
    deletedScanJobs,
    deletedInFlightAnalysisRows,
    removedDiskPaths,
    nextPendingVersion: next?.pendingVersion?.trim() || null,
  }
}
