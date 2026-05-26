"use server"

import {
  mapDynamicAnalysisStatusByStoreId,
  type DynamicAnalysisDisplayStatus,
} from "@/lib/dynamic-analysis-status"
import { prisma } from "@/lib/prisma"

export type ExtensionWithAnalysis = {
  id: string
  storeId: string
  name: string
  version: string | null
  publisher: string | null
  packageDownloadPrefix: string | null
  packageDownloadSuffix: string | null
  updatedAt: Date
  riskLevel: string
  analysisStatus: string
  filesScanned: number
  dynamicAnalysisStatus: DynamicAnalysisDisplayStatus
}

export async function listExtensionsWithAnalysis(): Promise<ExtensionWithAnalysis[]> {
  const extensions = await prisma.globalExtension.findMany({
    orderBy: {
      updatedAt: 'desc',
    },
    include: {
      analysisResults: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  })

  const dynamicStatusByStoreId = await mapDynamicAnalysisStatusByStoreId(
    extensions.map((ext) => ({ storeId: ext.storeId, version: ext.version })),
  )

  return extensions.map((ext) => {
    const latestAnalysis = ext.analysisResults[0]

    return {
      id: ext.id,
      storeId: ext.storeId,
      name: ext.name,
      version: ext.version,
      publisher: ext.publisher,
      packageDownloadPrefix: ext.packageDownloadPrefix ?? null,
      packageDownloadSuffix: ext.packageDownloadSuffix ?? null,
      updatedAt: ext.updatedAt,
      riskLevel: ext.riskLevel,
      analysisStatus: latestAnalysis?.status || 'PENDING',
      filesScanned: latestAnalysis?.filesScanned || 0,
      dynamicAnalysisStatus:
        dynamicStatusByStoreId.get(ext.storeId) ?? 'unavailable',
    }
  })
}

export async function getExtensions(): Promise<ExtensionWithAnalysis[]> {
  try {
    return await listExtensionsWithAnalysis()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[getExtensions] failed:', message)
    return []
  }
}

export async function getDashboardMetrics() {
  try {
    const [completedScanActions, completeBrowserAgentTasks] = await Promise.all([
      prisma.scanJob.count({
        where: {
          targetType: 'EXTENSION',
          status: 'COMPLETED',
        },
      }),
      prisma.browserAgentTask.count({
        where: { status: 'COMPLETE' },
      }),
    ])

    return { completedScanActions, completeBrowserAgentTasks }
  } catch {
    return { completedScanActions: 0, completeBrowserAgentTasks: 0 }
  }
}
