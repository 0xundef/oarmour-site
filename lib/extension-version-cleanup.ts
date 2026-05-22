import 'server-only'
import fs from 'fs'
import path from 'path'
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
      select: { version: true },
    })
    if (ext?.version?.trim() === version) {
      const nextVersion = await resolveNextGlobalVersion(params.extensionId, version)
      await tx.globalExtension.update({
        where: { id: params.extensionId },
        data: { version: nextVersion, updatedAt: new Date() },
      })
    }
  })

  rmDirIfExists(getExtensionSidecarRoot(params.storeId, version))
  rmDirIfExists(getExtensionArtifactRoot(params.storeId, version))

  const nextGlobalVersion = await prisma.globalExtension.findUnique({
    where: { id: params.extensionId },
    select: { version: true },
  })

  return {
    deletedVersion: version,
    nextGlobalVersion: nextGlobalVersion?.version?.trim() || null,
  }
}
