"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bell, Pencil, Play, Trash2 } from "lucide-react";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const editingExtension = rows.find((row) => row.id === editingId) ?? null;

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

  const openEditModal = (ext: ExtRow) => {
    setEditingId(ext.id);
    setDraftName(ext.name);
  };

  const saveExtensionName = () => {
    if (!editingExtension) return;
    const name = draftName.trim();
    if (!name) {
      toast({ variant: "destructive", description: "Extension name is required" });
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/extensions/${editingExtension.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Failed to update extension";
          throw new Error(message);
        }
        setRows((prev) => prev.map((r) => (r.id === editingExtension.id ? { ...r, name } : r)));
        toast({ description: "Extension updated" });
        setEditingId(null);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update extension";
        toast({ variant: "destructive", description: message });
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
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Operation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">
                  No extensions found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((ext) => (
                <TableRow key={ext.id}>
                  <TableCell>{ext.name}</TableCell>
                  <TableCell>{ext.version || "N/A"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => openEditModal(ext)}
                        aria-label="Edit extension"
                        title="Edit extension"
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => deleteExtension(ext.id)}
                        aria-label="Delete extension"
                        title="Delete extension"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editingExtension}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Extension</DialogTitle>
            <DialogDescription>
              Update the extension name and manage monitoring actions in one place.
            </DialogDescription>
          </DialogHeader>
          {editingExtension ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="extension-name">Extension Name</Label>
                <Input
                  id="extension-name"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label>Store ID</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                  {editingExtension.storeId}
                </div>
              </div>
              <div className="rounded-md border p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium">Monitoring Controls</h3>
                  <p className="text-sm text-muted-foreground">
                    These controls were moved from the table into this modal.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Monitoring</p>
                      <p className="text-sm text-muted-foreground">Enable scheduled checks for this extension.</p>
                    </div>
                    <Switch
                      checked={!!editingExtension.isMonitored}
                      onCheckedChange={(v) => toggleMonitor(editingExtension.id, v)}
                      disabled={pending}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Testing Mode</p>
                      <p className="text-sm text-muted-foreground">Use CDN test packages for monitor checks.</p>
                    </div>
                    <Switch
                      checked={!!editingExtension.testingMode}
                      onCheckedChange={(v) => toggleTestingMode(editingExtension.id, v)}
                      disabled={pending}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => runImmediateCheck(editingExtension.storeId, editingExtension.version)}
                    >
                      <Play className="mr-2 h-3.5 w-3.5" />
                      Run Check
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => notifyMaliciousSubscribers(editingExtension)}
                    >
                      <Bell className="mr-2 h-3.5 w-3.5" />
                      Notify Users
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveExtensionName} disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
