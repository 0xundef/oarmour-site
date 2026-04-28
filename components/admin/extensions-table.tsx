"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, Play, Trash2 } from "lucide-react";

type ExtRow = {
  id: string;
  name: string;
  storeId: string;
  version: string | null;
  isMonitored?: boolean;
  testingMode?: boolean;
  checkFrequencyMinutes?: number;
};

function getNextVersion(version?: string | null) {
  if (!version || !/^\d+(\.\d+)*$/.test(version)) return null;
  const parts = version.split(".").map((x) => Number.parseInt(x, 10));
  parts[parts.length - 1] = (parts[parts.length - 1] ?? 0) + 1;
  return parts.join(".");
}

export function ExtensionsTable({ extensions }: { extensions: ExtRow[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [rows, setRows] = useState<ExtRow[]>(extensions);

  useEffect(() => {
    setRows(extensions);
  }, [extensions]);

  const toggleMonitor = (id: string, enabled: boolean) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/extensions/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, isMonitored: enabled }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast({ description: enabled ? "Monitoring enabled" : "Monitoring disabled" });
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, isMonitored: enabled } : r)));
        router.refresh();
      } catch {
        toast({ variant: "destructive", description: "Failed to update monitoring setting" });
      }
    });
  };

  const toggleTestingMode = (id: string, enabled: boolean) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/extensions/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, testingMode: enabled }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast({ description: enabled ? "Testing mode enabled" : "Testing mode disabled" });
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, testingMode: enabled } : r)));
        router.refresh();
      } catch {
        toast({ variant: "destructive", description: "Failed to update testing mode" });
      }
    });
  };
  
  const deleteExtension = (id: string) => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/extensions/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Delete failed");
        }
        toast({ description: "Extension deleted" });
        setRows((prev) => prev.filter((r) => r.id !== id));
        router.refresh();
      } catch {
        toast({ variant: "destructive", description: "Failed to delete extension" });
      }
    });
  };

  const runImmediateCheck = (storeId: string, currentVersion?: string | null) => {
    startTransition(async () => {
      try {
        const nextVersion = getNextVersion(currentVersion) ?? "{next-version}";
        const downloadUri = `https://cdn.oarmour.com/${storeId}/${nextVersion}.zip`;
        console.info("[monitor-check] next download uri:", downloadUri);
        const res = await fetch("/api/monitor/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message = typeof payload?.error === "string" ? payload.error : "Immediate check failed";
          throw new Error(message);
        }
        const result = await res.json();
        const updatedCount = Array.isArray(result?.updated) ? result.updated.length : 0;
        toast({
          description:
            updatedCount > 0
              ? `Immediate check finished. ${updatedCount} update(s) detected and analyzed.`
              : "Immediate check finished. No new version found.",
        });
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Immediate check failed";
        toast({ variant: "destructive", description: message });
      }
    });
  };

  const notifyMaliciousSubscribers = (ext: ExtRow) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/extensions/notify-malicious", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ext.id, storeId: ext.storeId }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            typeof payload?.error === "string" ? payload.error : "Failed to send malicious alert emails";
          throw new Error(message);
        }
        const reason = typeof payload?.result?.reason === "string" ? payload.result.reason : "";
        const sent = typeof payload?.result?.sent === "number" ? payload.result.sent : 0;
        const attempted = typeof payload?.result?.attempted === "number" ? payload.result.attempted : 0;
        if (reason === "degraded") {
          toast({
            variant: "destructive",
            description: "Notification subscription is unavailable in this environment (degraded mode).",
          });
          return;
        }
        toast({
          description:
            attempted > 0
              ? `Malicious alert email sent to ${sent}/${attempted} subscribed user(s).`
              : "No subscribed users found for this extension.",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send malicious alert emails";
        toast({ variant: "destructive", description: message });
      }
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Store ID</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Testing Mode</TableHead>
            <TableHead>Operation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                No extensions found.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((ext) => (
              <TableRow key={ext.id}>
                <TableCell>{ext.name}</TableCell>
                <TableCell className="font-mono text-xs">{ext.storeId}</TableCell>
                <TableCell>{ext.version || "N/A"}</TableCell>
                <TableCell>
                  <Switch
                    checked={!!ext.testingMode}
                    onCheckedChange={(v) => toggleTestingMode(ext.id, v)}
                    disabled={pending}
                  />
                </TableCell>
                <TableCell className="flex items-center gap-3">
                  <Switch
                    checked={!!ext.isMonitored}
                    onCheckedChange={(v) => toggleMonitor(ext.id, v)}
                    disabled={pending}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => runImmediateCheck(ext.storeId, ext.version)}
                    aria-label="Run immediate check"
                    title="Run immediate check now"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={pending}
                    onClick={() => notifyMaliciousSubscribers(ext)}
                    aria-label="Notify subscribed users"
                    title="Notify subscribed users (malicious alert)"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="ml-2"
                    disabled={pending}
                    onClick={() => deleteExtension(ext.id)}
                    aria-label="Delete extension"
                    title="Delete extension"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
