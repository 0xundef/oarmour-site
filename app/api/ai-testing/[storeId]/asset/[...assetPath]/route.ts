import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import { normalizeAiTestingImageRelativePath } from '@/lib/ai-testing-asset-path'
import { getAiTestingRunRoot } from '@/lib/extension-storage'

export const runtime = 'nodejs'

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ storeId: string; assetPath: string[] }> },
) {
  const { storeId, assetPath } = await context.params
  const [version, runId, ...relativePath] = assetPath || []
  if (!storeId || !version || !runId || relativePath.length === 0) {
    return NextResponse.json({ error: 'Invalid AI testing asset path' }, { status: 400 })
  }

  const runRoot = getAiTestingRunRoot(storeId, version, runId)
  const normalizedRoot = `${path.resolve(runRoot)}${path.sep}`
  const relativeImage = normalizeAiTestingImageRelativePath(relativePath.join('/'))
  const segments = relativeImage.split('/').filter(Boolean)

  const candidates = [
    path.resolve(runRoot, ...segments),
    path.resolve(runRoot, path.basename(relativeImage)),
  ]
  const filePath = candidates.find(
    (candidate) => candidate.startsWith(normalizedRoot) && fs.existsSync(candidate),
  )
  if (!filePath) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
  }

  const bytes = fs.readFileSync(filePath)
  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  return new NextResponse(bytes, {
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  })
}
