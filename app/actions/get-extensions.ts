"use server"

import { prisma } from "@/lib/prisma"

export type ExtensionWithAnalysis = {
  id: string
  storeId: string
  name: string
  version: string | null
  publisher: string | null
  updatedAt: Date
  riskLevel: string
  analysisStatus: string
  filesScanned: number
}

export async function getExtensions(): Promise<ExtensionWithAnalysis[]> {
  const extensions = await prisma.globalExtension.findMany({
    orderBy: {
      updatedAt: 'desc'
    },
    include: {
      analysisResults: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  })

  return extensions.map((ext: any) => {
    const latestAnalysis = ext.analysisResults[0]
    
    return {
      id: ext.id,
      storeId: ext.storeId,
      name: ext.name,
      version: ext.version,
      publisher: ext.publisher,
      updatedAt: ext.updatedAt,
      // Map DB RiskLevel to UI string
      riskLevel: ext.riskLevel, 
      // Determine status: if analysis is running or no analysis yet
      analysisStatus: latestAnalysis?.status || 'PENDING',
      filesScanned: latestAnalysis?.filesScanned || 0
    }
  })
}
