import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AggregateRow = {
  totalRuns: number | bigint
  successfulRuns: number | bigint
  failedRuns: number | bigint
  totalChecked: number | bigint
  totalUpdated: number | bigint
  monitoredExtensions: number | bigint
}

type HistoryRow = {
  id: string
  status: string
  checkedCount: number
  succeededCount: number
  failedCount: number
  updatedCount: number
  startedAt: Date
  endedAt: Date | null
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [aggregate] = await prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COUNT(*) AS "totalRuns",
        SUM(CASE WHEN "status" = 'COMPLETED' THEN 1 ELSE 0 END) AS "successfulRuns",
        SUM(CASE WHEN "status" = 'FAILED' THEN 1 ELSE 0 END) AS "failedRuns",
        COALESCE(SUM("checkedCount"), 0) AS "totalChecked",
        COALESCE(SUM("updatedCount"), 0) AS "totalUpdated",
        (SELECT COUNT(*) FROM "GlobalExtension" WHERE "isMonitored" = true) AS "monitoredExtensions"
      FROM "MonitorRun"
      WHERE "status" IN ('COMPLETED', 'FAILED')
    `;
    const range = req.nextUrl.searchParams.get("range")
    const dayMs = 24 * 60 * 60 * 1000
    const rangeMsMap: Record<string, number> = {
      "1d": dayMs,
      "2d": 2 * dayMs,
    }
    const selectedRange = range && rangeMsMap[range] ? range : "1d"
    const serverNow = new Date()
    const since = new Date(serverNow.getTime() - rangeMsMap[selectedRange])
    const history = await prisma.$queryRaw<HistoryRow[]>`
      SELECT
        "id",
        "status",
        "checkedCount",
        "succeededCount",
        "failedCount",
        "updatedCount",
        "startedAt",
        "endedAt"
      FROM "MonitorRun"
      WHERE "startedAt" >= ${since}
      ORDER BY "startedAt" DESC
      LIMIT 1000
    `;
    const [latest] = await prisma.$queryRaw<Array<{ startedAt: Date; status: string }>>`
      SELECT "startedAt","status"
      FROM "MonitorRun"
      ORDER BY "startedAt" DESC
      LIMIT 1
    `;
    const periodMinutes = Number(process.env.EXT_MONITOR_PERIOD_MINUTES ?? "30")
    const periodMs = Number.isFinite(periodMinutes) && periodMinutes > 0 ? periodMinutes * 60000 : 1800000
    const nextRunAt = latest?.startedAt ? new Date(new Date(latest.startedAt).getTime() + periodMs).toISOString() : null
    const monitorEnabled = process.env.EXT_MONITOR_ENABLED !== "0"
    const serviceHealth =
      !monitorEnabled
        ? "DISABLED"
        : latest?.status === "FAILED"
          ? "DEGRADED"
          : latest
            ? "HEALTHY"
            : "NO_DATA"
    return NextResponse.json({
      serviceHealth,
      monitorEnabled,
      totalRuns: Number(aggregate?.totalRuns ?? 0),
      successfulRuns: Number(aggregate?.successfulRuns ?? 0),
      failedRuns: Number(aggregate?.failedRuns ?? 0),
      totalChecked: Number(aggregate?.totalChecked ?? 0),
      totalUpdated: Number(aggregate?.totalUpdated ?? 0),
      monitoredExtensions: Number(aggregate?.monitoredExtensions ?? 0),
      range: selectedRange,
      rangeSince: since.toISOString(),
      serverNow: serverNow.toISOString(),
      nextRunAt,
      history: history.map((r) => ({
        id: r.id,
        status: r.status,
        checkedCount: r.checkedCount,
        succeededCount: r.succeededCount,
        failedCount: r.failedCount,
        updatedCount: r.updatedCount,
        startedAt: new Date(r.startedAt).toISOString(),
        endedAt: r.endedAt ? new Date(r.endedAt).toISOString() : null,
      })),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
