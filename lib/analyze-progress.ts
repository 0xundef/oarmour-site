type AnalyzeStage = "DOWNLOADING" | "EXTRACTING" | "QUEUED" | "ANALYZING" | "COMPLETED" | "FAILED"

export type AnalyzeProgressSnapshot = {
  extensionId: string
  stage: AnalyzeStage
  progress: number
  message: string
  bytesReceived: number | null
  totalBytes: number | null
  done: boolean
  success: boolean | null
  updatedAt: number
}

const STORE_TTL_MS = 30 * 60 * 1000
const progressStore = new Map<string, AnalyzeProgressSnapshot>()

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function upsert(extensionId: string, patch: Partial<AnalyzeProgressSnapshot>) {
  const prev = progressStore.get(extensionId)
  const next: AnalyzeProgressSnapshot = {
    extensionId,
    stage: patch.stage ?? prev?.stage ?? "DOWNLOADING",
    progress: clampProgress(patch.progress ?? prev?.progress ?? 0),
    message: patch.message ?? prev?.message ?? "",
    bytesReceived: patch.bytesReceived ?? prev?.bytesReceived ?? null,
    totalBytes: patch.totalBytes ?? prev?.totalBytes ?? null,
    done: patch.done ?? prev?.done ?? false,
    success: patch.success ?? prev?.success ?? null,
    updatedAt: Date.now(),
  }
  progressStore.set(extensionId, next)
  return next
}

export function setAnalyzeProgressStage(
  extensionId: string,
  stage: AnalyzeStage,
  progress: number,
  message: string,
) {
  return upsert(extensionId, {
    stage,
    progress,
    message,
    done: stage === "COMPLETED" || stage === "FAILED",
    success: stage === "COMPLETED" ? true : stage === "FAILED" ? false : null,
  })
}

export function setAnalyzeDownloadProgress(extensionId: string, bytesReceived: number, totalBytes?: number | null) {
  const computed =
    typeof totalBytes === "number" && totalBytes > 0
      ? clampProgress((bytesReceived / totalBytes) * 60)
      : Math.max(1, Math.min(55, Math.round(bytesReceived / (1024 * 200))))
  return upsert(extensionId, {
    stage: "DOWNLOADING",
    progress: computed,
    message: "Downloading package",
    bytesReceived,
    totalBytes: totalBytes ?? null,
    done: false,
    success: null,
  })
}

export function clearAnalyzeProgress(extensionId: string) {
  progressStore.delete(extensionId)
}

export function getAnalyzeProgress(extensionId: string) {
  const current = progressStore.get(extensionId)
  if (!current) return null
  if (Date.now() - current.updatedAt > STORE_TTL_MS) {
    progressStore.delete(extensionId)
    return null
  }
  return current
}
