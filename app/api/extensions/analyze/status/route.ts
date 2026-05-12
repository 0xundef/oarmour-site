import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAnalyzeProgress } from '@/lib/analyze-progress'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const extensionId = req.nextUrl.searchParams.get('extensionId')?.trim()
    if (!extensionId) {
      return NextResponse.json({ error: 'extensionId is required' }, { status: 400 })
    }

    const memory = getAnalyzeProgress(extensionId)
    if (memory?.done) {
      return NextResponse.json({
        extensionId,
        stage: memory.stage,
        progress: memory.progress,
        message: memory.message,
        done: memory.done,
        success: memory.success,
        bytesReceived: memory.bytesReceived,
        totalBytes: memory.totalBytes,
        source: 'memory',
      })
    }

    const extension = await prisma.globalExtension.findUnique({
      where: { storeId: extensionId },
      select: { id: true },
    })

    if (!extension) {
      if (memory) {
        return NextResponse.json({
          extensionId,
          stage: memory.stage,
          progress: memory.progress,
          message: memory.message,
          done: memory.done,
          success: memory.success,
          bytesReceived: memory.bytesReceived,
          totalBytes: memory.totalBytes,
          source: 'memory',
        })
      }
      return NextResponse.json({
        extensionId,
        stage: 'DOWNLOADING',
        progress: 5,
        message: 'Preparing download',
        done: false,
        success: null,
        source: 'fallback',
      })
    }

    const [job, analysis] = await Promise.all([
      prisma.scanJob.findFirst({
        where: { targetType: 'EXTENSION', targetId: extension.id },
        orderBy: { startedAt: 'desc' },
        select: { status: true },
      }),
      prisma.extensionAnalysisResult.findFirst({
        where: { extensionId: extension.id },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      }),
    ])

    if (job?.status === 'FAILED' || analysis?.status === 'FAILED') {
      return NextResponse.json({
        extensionId,
        stage: 'FAILED',
        progress: 100,
        message: 'Analysis failed',
        done: true,
        success: false,
        source: 'fallback',
      })
    }
    if (job?.status === 'RUNNING' || analysis?.status === 'RUNNING') {
      return NextResponse.json({
        extensionId,
        stage: 'ANALYZING',
        progress: 85,
        message: 'Running analysis',
        done: false,
        success: null,
        source: 'fallback',
      })
    }
    if (job?.status === 'PENDING') {
      return NextResponse.json({
        extensionId,
        stage: 'QUEUED',
        progress: 75,
        message: 'Queued for analysis',
        done: false,
        success: null,
        source: 'fallback',
      })
    }
    if (job?.status === 'COMPLETED' || analysis?.status === 'COMPLETED') {
      return NextResponse.json({
        extensionId,
        stage: 'COMPLETED',
        progress: 100,
        message: 'Analysis completed',
        done: true,
        success: true,
        source: 'fallback',
      })
    }
    if (memory) {
      return NextResponse.json({
        extensionId,
        stage: memory.stage,
        progress: memory.progress,
        message: memory.message,
        done: memory.done,
        success: memory.success,
        bytesReceived: memory.bytesReceived,
        totalBytes: memory.totalBytes,
        source: 'memory',
      })
    }

    return NextResponse.json({
      extensionId,
      stage: 'PROCESSING',
      progress: 50,
      message: 'Processing extension',
      done: false,
      success: null,
      source: 'fallback',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get analyze status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
