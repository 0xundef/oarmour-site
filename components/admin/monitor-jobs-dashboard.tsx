"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  buildMonitorOutcomeBuckets,
  getMonitorIntervalMs,
  type MonitorHistoryPoint,
  type MonitorOutcomeBucket,
} from "@/lib/monitor-outcome-buckets";

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
  monitorIntervalMinutes?: number
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

type TimeRange = "1d" | "2d"

const DAY_MS = 24 * 60 * 60 * 1000

const RANGE_MS: Record<TimeRange, number> = {
  "1d": DAY_MS,
  "2d": 2 * DAY_MS,
}

type TrendDatum = MonitorHistoryPoint

function formatRangeBound(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function MonitorOutcomeChart({
  buckets,
  intervalMinutes,
  onSelectBucket,
}: {
  buckets: MonitorOutcomeBucket[]
  intervalMinutes: number
  onSelectBucket: (run: TrendDatum | null) => void
}) {
  if (buckets.length === 0) {
    return <div className="text-sm text-muted-foreground">No time slots in range</div>
  }

  const tickInterval = Math.max(0, Math.floor(buckets.length / 12) - 1)

  return (
    <div className="space-y-3">
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={buckets}
            margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
            barCategoryGap="12%"
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="slotLabel"
              tick={{ fontSize: 10 }}
              interval={tickInterval}
              angle={-35}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }}
              formatter={(value, name) => [value ?? 0, name]}
              labelFormatter={(_label, payload) => {
                const row = payload?.[0]?.payload as MonitorOutcomeBucket | undefined
                if (!row) return ""
                const end = new Date(row.bucketStartMs + intervalMinutes * 60 * 1000)
                return `${row.slotLabel} – ${formatRangeBound(end.toISOString())} · ${row.runCount} run(s)`
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="succeededCount"
              stackId="outcome"
              fill="#16a34a"
              name="Succeeded"
              barSize={10}
              radius={[4, 4, 0, 0]}
              onClick={(entry) => {
                const row = entry as MonitorOutcomeBucket
                onSelectBucket(row.representativeRun)
              }}
            />
            <Bar
              dataKey="failedCount"
              stackId="outcome"
              fill="#dc2626"
              name="Failed"
              barSize={10}
              radius={[4, 4, 0, 0]}
              onClick={(entry) => {
                const row = entry as MonitorOutcomeBucket
                onSelectBucket(row.representativeRun)
              }}
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
  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
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

  const { windowStartMs, windowEndMs, rangeSinceIso, rangeEndIso, intervalMs, intervalMinutes } =
    useMemo(() => {
      const endMs = stats?.serverNow ? new Date(stats.serverNow).getTime() : Date.now()
      const sinceMs = stats?.rangeSince
        ? new Date(stats.rangeSince).getTime()
        : endMs - RANGE_MS[timeRange]
      const safeEnd = Number.isFinite(endMs) ? endMs : Date.now()
      const safeStart = Number.isFinite(sinceMs) ? sinceMs : safeEnd - RANGE_MS[timeRange]
      const minutes = stats?.monitorIntervalMinutes
      const ms = getMonitorIntervalMs(minutes)
      return {
        windowStartMs: safeStart,
        windowEndMs: safeEnd,
        rangeSinceIso: stats?.rangeSince ?? new Date(safeStart).toISOString(),
        rangeEndIso: stats?.serverNow ?? new Date(safeEnd).toISOString(),
        intervalMs: ms,
        intervalMinutes:
          typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 ? minutes : 30,
      }
    }, [stats?.rangeSince, stats?.serverNow, stats?.monitorIntervalMinutes, timeRange])

  const value = (v: number | undefined) => (loading ? "..." : String(v ?? 0));
  const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "N/A")

  const chartData: TrendDatum[] = useMemo(() => {
    const ordered = [...(stats?.history ?? [])].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    )
    return ordered.map((point) => {
      const startedAtMs = new Date(point.startedAt).getTime()
      return { ...point, startedAtMs }
    })
  }, [stats?.history])

  const outcomeBuckets = useMemo(
    () =>
      buildMonitorOutcomeBuckets({
        history: chartData,
        windowStartMs,
        windowEndMs,
        intervalMs,
      }),
    [chartData, windowStartMs, windowEndMs, intervalMs],
  )

  const runCountInRange = chartData.length
  const slotsWithRuns = outcomeBuckets.filter((b) => b.runCount > 0).length
  const selectedRunInRange =
    selectedRun && chartData.some((item) => item.id === selectedRun.id) ? selectedRun : null
  const activeRun = selectedRunInRange || chartData[chartData.length - 1] || null
  const rangeLabel = timeRange === "1d" ? "past 1 day" : "past 2 days"

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
                variant={timeRange === "1d" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setTimeRange("1d")}
              >
                1d
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timeRange === "2d" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setTimeRange("2d")}
              >
                2d
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
                {`${runCountInRange} run(s) in ${slotsWithRuns}/${outcomeBuckets.length} slot(s) (${intervalMinutes}m interval) · ${rangeLabel} · ${formatRangeBound(rangeSinceIso)} – ${formatRangeBound(rangeEndIso)}`}
              </p>
              <MonitorOutcomeChart
                buckets={outcomeBuckets}
                intervalMinutes={intervalMinutes}
                onSelectBucket={setSelectedRun}
              />
              {activeRun ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-medium">Selected Run</div>
                  <div className="mt-1">{toLocal(activeRun.startedAt)}</div>
                  <div className="mt-1">{`status ${activeRun.status}, checked ${activeRun.checkedCount}, succeeded ${activeRun.succeededCount}, failed ${activeRun.failedCount}, updated ${activeRun.updatedCount}`}</div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Click a slot with runs to view details (empty slots = no monitor run in that interval)
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
