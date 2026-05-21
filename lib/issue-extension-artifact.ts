import { prisma } from "@/lib/prisma"
import {
  getExtensionAnalysisDir,
  getExtensionArtifactRoot,
  getExtensionSidecarRoot,
} from "@/lib/extension-storage"

export type IssueExtensionArtifactContext = {
  storeId: string
  version: string
  extensionRoot: string
  sidecarRoot: string
  analysisDir: string
}

export async function resolveIssueExtensionArtifact(
  storeId: string,
): Promise<IssueExtensionArtifactContext | null> {
  const ext = await prisma.globalExtension.findUnique({
    where: { storeId },
    select: { version: true },
  })
  const version = ext?.version?.trim()
  if (!version) return null

  return {
    storeId,
    version,
    extensionRoot: getExtensionArtifactRoot(storeId, version),
    sidecarRoot: getExtensionSidecarRoot(storeId, version),
    analysisDir: getExtensionAnalysisDir(storeId, version),
  }
}
