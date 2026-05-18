"use server"

import { prisma } from "@/lib/prisma"

export type ExtensionWithAnalysis = {
  id: string
  storeId: string
  name: string
  version: string | null
  publisher: string | null
  testingMode: boolean
  updatedAt: Date
  riskLevel: string
  analysisStatus: string
  filesScanned: number
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

  return extensions.map((ext) => {
    const latestAnalysis = ext.analysisResults[0]

    return {
      id: ext.id,
      storeId: ext.storeId,
      name: ext.name,
      version: ext.version,
      publisher: ext.publisher,
      testingMode: !!(ext as { testingMode?: boolean }).testingMode,
      updatedAt: ext.updatedAt,
      riskLevel: ext.riskLevel,
      analysisStatus: latestAnalysis?.status || 'PENDING',
      filesScanned: latestAnalysis?.filesScanned || 0,
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
    const completedScanActions = await prisma.scanJob.count({
      where: {
        targetType: 'EXTENSION',
        status: 'COMPLETED',
      },
    })

    return { completedScanActions }
  } catch {
    return { completedScanActions: 0 }
  }
}
