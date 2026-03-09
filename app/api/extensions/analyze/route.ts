import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { processExtension } from "@/lib/analysis-service";

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
    if (adapterEnabled && session?.user?.id) {
      try {
        const exists = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true },
        });
        if (exists) {
          await prisma.submission.create({
            data: {
              userId: session.user.id,
              input: extensionId,
              status: 'APPROVED',
              feedback: 'Analysis triggered via UI',
            },
          });
        }
      } catch (e) {
        console.error('Failed to record submission:', e);
        // Continue with analysis even if submission recording fails
      }
    }

    // 1. Check if extension exists in DB (cached)
    let extension = await prisma.globalExtension.findUnique({
      where: { storeId: extensionId }
    });

    // If it exists and is recent (e.g. < 24h), return it? 
    // For now, if it exists, we just return it to be fast.
    // The user can force re-analysis if we add a flag later.
    if (extension) {
        // Check if there is a completed analysis
        const analysis = await prisma.extensionAnalysisResult.findFirst({
            where: { extensionId: extension.id, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' }
        });

        if (analysis) {
             return NextResponse.json({ 
                success: true, 
                data: extension,
                analysis: analysis,
                message: 'Extension found in cache' 
            });
        }
    }

    // 2. Process Extension (Download, Extract, Upsert, Analyze)
    extension = await processExtension(extensionId);

    return NextResponse.json({ 
        success: true, 
        data: extension,
        message: 'Extension processing started' 
    });

  } catch (error) {
    console.error('Analysis handler error:', error);
    return NextResponse.json({ 
        error: 'Failed to process extension',
        details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
