import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
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
  const filePath = path.resolve(runRoot, ...relativePath)
  const normalizedRoot = `${path.resolve(runRoot)}${path.sep}`
  if (!filePath.startsWith(normalizedRoot) || !fs.existsSync(filePath)) {
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
