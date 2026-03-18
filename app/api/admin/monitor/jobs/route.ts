import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Row = {
  status: string;
  count: number | bigint;
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT t.status, COUNT(*) AS count
      FROM (
        SELECT DISTINCT ON ("extensionId") "extensionId", "status"
        FROM "ExtensionAnalysisResult"
        ORDER BY "extensionId", "createdAt" DESC
      ) t
      GROUP BY t.status
    `;
    let queue = 0;
    let processing = 0;
    let finished = 0;
    let failed = 0;
    for (const r of rows) {
      const c = Number(r.count);
      if (r.status === "PENDING") queue += c;
      if (r.status === "RUNNING") processing += c;
      if (r.status === "COMPLETED") finished += c;
      if (r.status === "FAILED") failed += c;
    }
    return NextResponse.json({
      queue,
      processing,
      finished,
      failed,
      total: queue + processing + finished + failed,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
