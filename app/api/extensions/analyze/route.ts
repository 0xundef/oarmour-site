import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { enqueueExtensionLookupJob, processExtension } from "@/lib/analysis-service";
import { setAnalyzeProgressStage } from '@/lib/analyze-progress';

const EXT_ID_REGEX = /^[a-z]{32}$/;

function extractExtensionIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (EXT_ID_REGEX.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    const isChromeWebStore =
      host.includes("chromewebstore.google.com") ||
      (host.includes("chrome.google.com") && path.includes("/webstore/"));
    if (isChromeWebStore && path.includes("/detail/")) {
      const match = path.match(/[a-z]{32}/);
      if (match) return match[0];
    }
    const customMatch = path.match(/^\/([a-z]{32})\/([^/]+)$/);
    if (customMatch && host === "cdn.oarmour.com") return customMatch[1];
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawExtensionId = typeof body?.extensionId === "string" ? body.extensionId.trim() : "";
    const rawDownloadUrl = typeof body?.downloadUrl === "string" ? body.downloadUrl.trim() : "";
    const extensionId = rawExtensionId || (rawDownloadUrl ? extractExtensionIdFromInput(rawDownloadUrl) : null);
    const downloadUrl = rawDownloadUrl || undefined;

    if (!extensionId) {
      return NextResponse.json({ error: 'Extension ID is required' }, { status: 400 });
    }
    if (downloadUrl) {
      try {
        const parsed = new URL(downloadUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return NextResponse.json({ error: 'Invalid download URL protocol' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid download URL' }, { status: 400 });
      }
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

    const extension = await prisma.globalExtension.findUnique({
      where: { storeId: extensionId }
    });

    if (downloadUrl) {
      setAnalyzeProgressStage(extensionId, 'DOWNLOADING', 1, 'Downloading package')
      void processExtension(extensionId, downloadUrl).catch((error) => {
        console.error('Async custom URI analysis failed:', error);
      });
      return NextResponse.json({
        success: true,
        queued: true,
        message: 'Extension submitted from custom download URI. Download and analysis started in background.'
      }, { status: 202 });
    }

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
        setAnalyzeProgressStage(extensionId, 'QUEUED', 75, 'Queued for analysis')
        return NextResponse.json({
          success: true,
          data: extension,
          queued: true,
          queue,
          message: 'Extension submitted. Lookup is queued for background processing.',
        }, { status: 202 })
    }

    void processExtension(extensionId, downloadUrl).catch((error) => {
      console.error('Async extension analysis failed:', error);
    });
    setAnalyzeProgressStage(extensionId, 'DOWNLOADING', 1, 'Downloading package')

    return NextResponse.json({ 
        success: true, 
        queued: true,
        message: 'Extension submitted. Download and analysis started in background.' 
    }, { status: 202 });

  } catch (error) {
    console.error('Analysis handler error:', error);
    return NextResponse.json({ 
        error: 'Failed to process extension',
        details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
