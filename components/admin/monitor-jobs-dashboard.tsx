"use client";

import { useEffect, useState } from "react";
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

type TimeRange = "24h" | "7d"

type TrendDatum = {
  id: string
  status: string
  checkedCount: number
  succeededCount: number
  failedCount: number
  updatedCount: number
  startedAt: string
  timeLabel: string
}

function MonitorOutcomeChart({ chartData }: { chartData: TrendDatum[] }) {
  const completedHistory = chartData.filter((point) => point.status === "COMPLETED")
  if (completedHistory.length === 0) {
    return <div className="text-sm text-muted-foreground">No outcome data yet</div>
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
            <XAxis dataKey="timeLabel" tick={{ fontSize: 11 }} minTickGap={18} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#e2e8f0" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="succeededCount" stackId="outcome" fill="#16a34a" name="Succeeded" radius={[4, 4, 0, 0]} />
            <Bar dataKey="failedCount" stackId="outcome" fill="#dc2626" name="Failed" radius={[4, 4, 0, 0]} />
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
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/admin/monitor/jobs?range=${timeRange}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
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

  const value = (v: number | undefined) => (loading ? "..." : String(v ?? 0));
  const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "N/A")
  const orderedHistory = [...(stats?.history || [])].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  )
  const rangeMsMap: Record<TimeRange, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  }
  const now = Date.now()
  const filteredHistory = orderedHistory.filter((item) => {
    const started = new Date(item.startedAt).getTime()
    return Number.isFinite(started) && started >= now - rangeMsMap[timeRange]
  })
  const chartData: TrendDatum[] = filteredHistory.map((point) => ({
    ...point,
    timeLabel:
      timeRange === "7d"
        ? new Date(point.startedAt).toLocaleString([], { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : new Date(point.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }))

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
                variant={timeRange === "24h" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setTimeRange("24h")}
              >
                24h
              </Button>
              <Button
                type="button"
                size="sm"
                variant={timeRange === "7d" ? "secondary" : "ghost"}
                className="h-7 px-2"
                onClick={() => setTimeRange("7d")}
              >
                7d
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <div className="text-sm text-muted-foreground">Loading trend...</div> : <MonitorOutcomeChart chartData={chartData} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recent Monitor Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(stats?.history || []).length === 0 ? (
            <div className="text-sm text-muted-foreground">{loading ? "Loading..." : "No monitor runs yet"}</div>
          ) : (
            (stats?.history || []).map((run) => (
              <div key={run.id} className="grid grid-cols-[180px_100px_1fr] gap-2 text-xs">
                <div>{toLocal(run.startedAt)}</div>
                <div>{run.status}</div>
                <div>{`checked ${run.checkedCount}, succeeded ${run.succeededCount}, failed ${run.failedCount}, updated ${run.updatedCount}`}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
