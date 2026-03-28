import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { enqueueExtensionLookupJob, processExtension } from "@/lib/analysis-service";

export async function POST(req: NextRequest) {
  try {
    const { extensionId } = await req.json();

    if (!extensionId) {
      return NextResponse.json({ error: 'Extension ID is required' }, { status: 400 });
    }

    // Record submission if adapter is enabled and user exists
    const adapterEnabled =
      process.env.NEXTAUTH_USE_ADAPTER === "1" ||
      (process.env.NODE_ENV === "production" && !!process.env.db1_POSTGRES_PRISMA_URL);
    const session = await getServerSession(authOptions);
    let submissionId: string | null = null
    if (adapterEnabled && session?.user?.id) {
      try {
        const exists = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true },
        });
        if (exists) {
          const submission = await prisma.submission.create({
            data: {
              userId: session.user.id,
              input: extensionId,
              status: 'PENDING',
              feedback: 'Lookup queued',
            },
            select: { id: true },
          });
          submissionId = submission.id
        }
      } catch (e) {
        console.error('Failed to record submission:', e);
      }
    }

    let extension = await prisma.globalExtension.findUnique({
      where: { storeId: extensionId }
    });

    if (extension) {
        const analysis = await prisma.extensionAnalysisResult.findFirst({
            where: { extensionId: extension.id, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' }
        });

        if (analysis) {
             if (submissionId) {
              await prisma.submission.update({
                where: { id: submissionId },
                data: {
                  status: 'APPROVED',
                  feedback: 'Cache hit: completed analysis already exists',
                },
              })
            }
             return NextResponse.json({ 
                success: true, 
                data: extension,
                analysis: analysis,
                message: 'Extension found in cache' 
            });
        }
        const queue = await enqueueExtensionLookupJob(extension.id)
        return NextResponse.json({
          success: true,
          data: extension,
          queued: true,
          queue,
          message: 'Extension submitted. Lookup is queued for background processing.',
        }, { status: 202 })
    }

    extension = await processExtension(extensionId);

    return NextResponse.json({ 
        success: true, 
        data: extension,
        queued: true,
        message: 'Extension submitted. Lookup is queued for background processing.' 
    }, { status: 202 });

  } catch (error) {
    console.error('Analysis handler error:', error);
    return NextResponse.json({ 
        error: 'Failed to process extension',
        details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
