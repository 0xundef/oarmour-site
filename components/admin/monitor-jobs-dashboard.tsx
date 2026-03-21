"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MonitorStats = {
  serviceHealth: string
  monitorEnabled: boolean
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

export function MonitorJobsDashboard() {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/monitor/jobs", { cache: "no-store" });
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
  }, []);

  const value = (v: number | undefined) => (loading ? "..." : String(v ?? 0));
  const toLocal = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString() : "N/A")

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
