import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { triggerMaliciousAlertNotifications } from "@/lib/notification-trigger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const storeId = typeof body?.storeId === "string" ? body.storeId.trim() : "";

    if (!id && !storeId) {
      return NextResponse.json({ error: "id or storeId is required" }, { status: 400 });
    }

    const extension = id
      ? await prisma.globalExtension.findUnique({
          where: { id },
          select: { id: true, storeId: true, name: true, riskLevel: true },
        })
      : await prisma.globalExtension.findUnique({
          where: { storeId },
          select: { id: true, storeId: true, name: true, riskLevel: true },
        });

    if (!extension) {
      return NextResponse.json({ error: "Extension not found" }, { status: 404 });
    }

    const latestAnalysis = await prisma.extensionAnalysisResult.findFirst({
      where: { extensionId: extension.id, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    let maliciousDomains: string[] = [];
    if (latestAnalysis?.id) {
      const matches = await prisma.domainEnrichment.findMany({
        where: { analysisId: latestAnalysis.id, isMalicious: true },
        select: { domain: true },
        take: 20,
      });
      maliciousDomains = Array.from(new Set(matches.map((d) => d.domain)));
    }

    const summary =
      maliciousDomains.length > 0
        ? "Manual alert triggered by administrator based on current malicious indicators."
        : "Manual alert triggered by administrator for a high-risk extension.";

    const notifyResult = await triggerMaliciousAlertNotifications(
      extension.storeId,
      extension.name || extension.storeId,
      String(extension.riskLevel),
      summary,
      maliciousDomains,
    );

    return NextResponse.json({
      ok: true,
      extensionId: extension.storeId,
      extensionName: extension.name,
      result: notifyResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
