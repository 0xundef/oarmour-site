"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MonitorStats = {
  queue: number;
  processing: number;
  finished: number;
  failed: number;
  total: number;
  updatedAt: string;
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

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Monitor Job Dashboard</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">In Queue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.queue)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Processing</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.processing)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Finished</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.finished)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.failed)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{value(stats?.total)}</CardContent>
        </Card>
      </div>
    </div>
  );
}
