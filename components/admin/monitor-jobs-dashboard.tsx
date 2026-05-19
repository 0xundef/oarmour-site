"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type MonitorStats = {
  serviceHealth: string
  monitorEnabled: boolean
  monitoredExtensions: number
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  totalChecked: number
  totalUpdated: number
  nextRunAt: string | null
  updatedAt: string
  range?: string
  rangeSince?: string
  serverNow?: string
  history: Array<{
    id: string
    status: string
    checkedCount: number
    succeededCount: number
    failedCount: number
    updatedCount: number
    startedAt: string
    endedAt: string | null
  }>
};

type TimeRange = "12h" | "24h"

const RANGE_MS: Record<TimeRange, number> = {
  "12h": 12 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
}

type TrendDatum = {
  id: string
  status: string
  checkedCount: number
  succeededCount: number
  failedCount: number
  updatedCount: number
  startedAt: string
  startedAtMs: number
  timeLabel: string
}

function formatAxisTick(ms: number, timeRange: TimeRange) {
  if (timeRange === "24h") {
    return new Date(ms).toLocaleString([], {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatRangeBound(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MonitorOutcomeChart({
  chartData,
  timeRange,
  windowStartMs,
  windowEndMs,
  onSelectRun,
}: {
  chartData: TrendDatum[]
  timeRange: TimeRange
  windowStartMs: number
  windowEndMs: number
  onSelectRun: (run: TrendDatum) => void
}) {
  const completedHistory = chartData.filter((point) => point.status === "COMPLETED")
  if (completedHistory.length === 0) {
    return <div className="text-sm text-muted-foreground">No outcome data in this time window</div>
  }

  const latest = completedHistory.map((point) => ({
    ...point,
    outcomeTotal: point.succeededCount + point.failedCount,
  }))
  const hasAnyOutcome = latest.some((item) => item.outcomeTotal > 0)
  if (!hasAnyOutcome) {
    return <div className="text-sm text-muted-foreground">No completed run has success/failure results yet</div>
  }

  return (
    <div className="space-y-3">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={latest} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="startedAtMs"
              type="number"
              scale="time"
              domain={[windowStartMs, windowEndMs]}
              tick={{ fontSize: 11 }}
              tickFormatter={(ms) => formatAxisTick(ms, timeRange)}
              minTickGap={28}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }}
              labelFormatter={(ms) => formatAxisTick(Number(ms), timeRange)}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="succeededCount"
              stackId="outcome"
              fill="#16a34a"
              name="Succeeded"
              radius={[4, 4, 0, 0]}
              onClick={(entry) => onSelectRun(entry as TrendDatum)}
            />
            <Bar
              dataKey="failedCount"
              stackId="outcome"
              fill="#dc2626"
              name="Failed"
              radius={[4, 4, 0, 0]}
              onClick={(entry) => onSelectRun(entry as TrendDatum)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />
          <span>Success Ratio</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
          <span>Failure Ratio</span>
        </div>
      </div>
    </div>
  )
}

export function MonitorJobsDashboard() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("12h");
  const [selectedRun, setSelectedRun] = useState<TrendDatum | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setSelectedRun(null);
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/admin/monitor/jobs?range=${timeRange}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as MonitorStats;
        if (mounted) setStats(json);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [timeRange]);

  const { windowStartMs, windowEndMs, rangeSinceIso, rangeEndIso } = useMemo(() => {
    const endMs = stats?.serverNow ? new Date(stats.serverNow).getTime() : Date.now()
    const sinceMs = stats?.rangeSince
      ? new Date(stats.rangeSince).getTime()
      : endMs - RANGE_MS[timeRange]
    const safeEnd = Number.isFinite(endMs) ? endMs : Date.now()
    const safeStart = Number.isFinite(sinceMs) ? sinceMs : safeEnd - RANGE_MS[timeRange]
    return {
      windowStartMs: safeStart,
      windowEndMs: safeEnd,
      rangeSinceIso: stats?.rangeSince ?? new Date(safeStart).toISOString(),
      rangeEndIso: stats?.serverNow ?? new Date(safeEnd).toISOString(),
    }
  }, [stats?.rangeSince, stats?.serverNow, timeRange])

  const value = (v: number | undefined) => (loading ? "..." : String(v ?? 0));
  const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "N/A")

  const chartData: TrendDatum[] = useMemo(() => {
    const ordered = [...(stats?.history ?? [])].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
    return ordered.map((point) => {
      const startedAtMs = new Date(point.startedAt).getTime()
      return {
        ...point,
        startedAtMs,
        timeLabel: formatAxisTick(startedAtMs, timeRange),
      }
    })
  }, [stats?.history, timeRange])

  const completedChartData = chartData.filter((point) => point.status === "COMPLETED")
  const selectedRunInRange = completedChartData.find((item) => item.id === selectedRun?.id) || null
  const activeRun = selectedRunInRange || completedChartData[completedChartData.length - 1] || null
  const rangeLabel = timeRange === "12h" ? "past 12 hours" : "past 24 hours"

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Monitor Service Dashboard</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Service Health</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{loading ? "..." : stats?.serviceHealth || "NO_DATA"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Runs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.totalRuns)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Successful Runs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.successfulRuns)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed Runs</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.failedRuns)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Updates Found</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.totalUpdated)}</CardContent>
        </Card>
      </div>
      {loading ? null : stats?.monitoredExtensions === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No extension is enabled for monitoring. Monitor runs can be COMPLETED with checked/succeeded/failed/updated all equal to 0.
            Enable monitoring in the Extension Management table to generate useful run metrics.
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Extensions Checked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.totalChecked)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Next Scheduled Run</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{loading ? "..." : toLocal(stats?.nextRunAt)}</CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Monitor Outcome Trend</CardTitle>
            <div className="flex items-center gap-1 rounded-md border p-1">
              <Button
                type="button"
                size="sm"
                variant={timeRange === "12h" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setTimeRange("12h")}
              >
                12h
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timeRange === "24h" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setTimeRange("24h")}
              >
                24h
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading trend...</div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {`${completedChartData.length} run(s) in the ${rangeLabel} · ${formatRangeBound(rangeSinceIso)} – ${formatRangeBound(rangeEndIso)}`}
              </p>
              <MonitorOutcomeChart
                chartData={chartData}
                timeRange={timeRange}
                windowStartMs={windowStartMs}
                windowEndMs={windowEndMs}
                onSelectRun={setSelectedRun}
              />
              {activeRun ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-medium">Selected Run</div>
                  <div className="mt-1">{toLocal(activeRun.startedAt)}</div>
                  <div className="mt-1">{`status ${activeRun.status}, checked ${activeRun.checkedCount}, succeeded ${activeRun.succeededCount}, failed ${activeRun.failedCount}, updated ${activeRun.updatedCount}`}</div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Click a green/red bar to view run details</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
