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
import { Pencil, Play, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiTestingRunButton } from "@/components/ai-testing/ai-testing-run-button";
import {
  loadAiTestingStatusMap,
  mergeAiTestingStatusMaps,
  type AiTestingStatusEntry,
} from "@/lib/ai-testing-status-client";
import { ExtensionPromptEditor } from "@/components/admin/extension-prompt-editor";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { Separator } from "@/components/ui/separator";

type ExtRow = {
  id: string;
  name: string;
  storeId: string;
  version: string | null;
  updatedAt?: string | null;
  isMonitored?: boolean;
  aiBrowserTestingEnabled?: boolean;
  checkFrequencyMinutes?: number;
  promptMarkdown?: string | null;
};

type VersionListItem = {
  version: string;
  hasStaticCompleted: boolean;
  hasAi: boolean;
  onDisk: boolean;
  lastUpdatedAt: string | null;
};

type DeleteVersionTarget = {
  ext: ExtRow;
  version: string;
};

function formatLastUpdate(iso?: string | null) {
  if (!iso) return "N/A";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "N/A";
  return date.toLocaleString();
}

export function ExtensionsTable({ extensions }: { extensions: ExtRow[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [rows, setRows] = useState<ExtRow[]>(extensions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteVersionTarget | null>(null);
  const [versionsByExtensionId, setVersionsByExtensionId] = useState<
    Record<string, VersionListItem[]>
  >({});
  const [selectedVersionByExtensionId, setSelectedVersionByExtensionId] = useState<
    Record<string, string>
  >({});
  const [aiTestingStatusByStoreId, setAiTestingStatusByStoreId] = useState<
    Record<string, AiTestingStatusEntry>
  >({});
  const editingExtension = rows.find((row) => row.id === editingId) ?? null;

  useEffect(() => {
    setRows(extensions);
  }, [extensions]);

  useEffect(() => {
    let cancelled = false;
    const loadAllVersions = async () => {
      const entries = await Promise.all(
        extensions.map(async (ext) => {
          try {
            const res = await fetch(`/api/admin/extensions/${ext.id}/versions`, {
              cache: "no-store",
            });
            if (!res.ok) return [ext.id, [] as VersionListItem[]] as const;
            const json = (await res.json()) as { versions?: VersionListItem[] };
            return [ext.id, json.versions ?? []] as const;
          } catch {
            return [ext.id, [] as VersionListItem[]] as const;
          }
        }),
      );
      if (cancelled) return;
      const nextVersions: Record<string, VersionListItem[]> = {};
      const nextSelected: Record<string, string> = {};
      for (const [id, versions] of entries) {
        nextVersions[id] = [...versions];
        const row = extensions.find((e) => e.id === id);
        const preferred =
          row?.version && versions.some((v) => v.version === row.version)
            ? row.version
            : versions[0]?.version ?? "";
        if (preferred) nextSelected[id] = preferred;
      }
      setVersionsByExtensionId(nextVersions);
      setSelectedVersionByExtensionId(nextSelected);
    };
    void loadAllVersions();
    return () => {
      cancelled = true;
    };
  }, [extensions]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await loadAiTestingStatusMap();
        if (!cancelled) {
          setAiTestingStatusByStoreId((prev) => mergeAiTestingStatusMaps(prev, next));
        }
      } catch {
        // ignore — button state may be stale until next poll
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleAiTestingTriggered = (storeId: string) => {
    setAiTestingStatusByStoreId((prev) => ({
      ...prev,
      [storeId]: { agentStatus: "pending", analysisStatus: null, analysisError: null },
    }));
  };

  const toggleAiBrowserTesting = (id: string, enabled: boolean) => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/extensions/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, aiBrowserTestingEnabled: enabled }),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast({
          description: enabled
            ? "AI browser testing enabled on new version detection"
            : "AI browser testing disabled; monitor will run static analysis only",
        });
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, aiBrowserTestingEnabled: enabled } : r)),
        );
        router.refresh();
      } catch {
        toast({ variant: "destructive", description: "Failed to update AI browser testing setting" });
      }
    });
  };

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

  const openEditModal = (ext: ExtRow) => {
    setEditingId(ext.id);
    setDraftName(ext.name);
    setDraftPrompt(ext.promptMarkdown ?? "");
    setPromptLoading(true);
    void fetch(`/api/admin/extensions/${ext.id}/prompt`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { promptMarkdown?: string };
        if (typeof json.promptMarkdown === "string") {
          setDraftPrompt(json.promptMarkdown);
        }
      })
      .catch(() => {})
      .finally(() => setPromptLoading(false));
  };

  const saveExtension = () => {
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
          body: JSON.stringify({ name, promptMarkdown: draftPrompt }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Failed to update extension";
          throw new Error(message);
        }
        setRows((prev) =>
          prev.map((r) =>
            r.id === editingExtension.id ? { ...r, name, promptMarkdown: draftPrompt } : r,
          ),
        );
        toast({ description: "Extension and prompt saved" });
        setEditingId(null);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update extension";
        toast({ variant: "destructive", description: message });
      }
    });
  };
  
  const refreshVersionsForExtension = async (extensionId: string) => {
    const res = await fetch(`/api/admin/extensions/${extensionId}/versions`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = (await res.json()) as { versions?: VersionListItem[] };
    const versions = json.versions ?? [];
    setVersionsByExtensionId((prev) => ({ ...prev, [extensionId]: versions }));
    setSelectedVersionByExtensionId((prev) => {
      const current = prev[extensionId];
      if (current && versions.some((v) => v.version === current)) {
        return prev;
      }
      const row = rows.find((r) => r.id === extensionId);
      const preferred =
        row?.version && versions.some((v) => v.version === row.version)
          ? row.version
          : versions[0]?.version ?? "";
      if (!preferred) {
        const next = { ...prev };
        delete next[extensionId];
        return next;
      }
      return { ...prev, [extensionId]: preferred };
    });
  };

  const confirmDeleteVersion = () => {
    if (!deleteTarget) return;
    const { ext, version } = deleteTarget;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/extensions/${ext.id}/versions`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            typeof payload?.error === "string" ? payload.error : "Delete version failed";
          throw new Error(message);
        }
        toast({ description: `Deleted version ${version} for ${ext.name}` });
        setDeleteTarget(null);
        await refreshVersionsForExtension(ext.id);
        setRows((prev) =>
          prev.map((r) =>
            r.id === ext.id
              ? {
                  ...r,
                  version:
                    typeof payload?.nextGlobalVersion === "string"
                      ? payload.nextGlobalVersion
                      : r.version === version
                        ? null
                        : r.version,
                }
              : r,
          ),
        );
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Delete version failed";
        toast({ variant: "destructive", description: message });
      }
    });
  };

  const runImmediateCheck = (ext: ExtRow) => {
    if (!ext.isMonitored) {
      toast({ variant: "destructive", description: "Monitoring is not enabled for this extension. Enable it first." });
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/monitor/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: ext.storeId }),
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

  return (
    <>
      <div className="rounded-md border">
        <Table className="table-fixed">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-48" />
            <col className="w-[40rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="w-28 px-4">Version</TableHead>
              <TableHead className="w-48 whitespace-nowrap px-4">Last Update</TableHead>
              <TableHead className="w-[40rem] whitespace-nowrap px-4">Operation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  No extensions found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((ext) => (
                <TableRow key={ext.id}>
                  <TableCell className="truncate px-4">{ext.name}</TableCell>
                  <TableCell className="w-28 whitespace-nowrap px-4">{ext.version || "N/A"}</TableCell>
                  <TableCell className="w-48 whitespace-nowrap px-4 text-muted-foreground">
                    {formatLastUpdate(ext.updatedAt)}
                  </TableCell>
                  <TableCell className="w-[40rem] whitespace-nowrap px-4">
                    <div className="flex flex-nowrap items-center justify-start gap-2">
                      <div
                        className="flex items-center gap-1.5"
                        role="group"
                        aria-label="Monitoring options"
                      >
                        <span title="Turn version monitoring on or off for this extension">
                          <Switch
                            checked={!!ext.isMonitored}
                            onCheckedChange={(v) => toggleMonitor(ext.id, v)}
                            disabled={pending}
                            aria-label="Toggle monitoring"
                          />
                        </span>
                        <span title="When monitoring detects a new version, also queue AI browser testing (static analysis always runs)">
                          <Switch
                            checked={!!ext.aiBrowserTestingEnabled}
                            onCheckedChange={(v) => toggleAiBrowserTesting(ext.id, v)}
                            disabled={pending || !ext.isMonitored}
                            aria-label="Toggle AI browser testing on monitor"
                          />
                        </span>
                      </div>
                      <Separator orientation="vertical" className="h-6" />
                      <AiTestingRunButton
                        storeId={ext.storeId}
                        extensionName={ext.name}
                        version={ext.version}
                        statusEntry={aiTestingStatusByStoreId[ext.storeId]}
                        onTriggered={handleAiTestingTriggered}
                        disabled={pending}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => runImmediateCheck(ext)}
                        aria-label="Run immediate check"
                        title="Run an immediate version check now"
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Check
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => openEditModal(ext)}
                        aria-label="Edit extension"
                        title="Edit name and AI test prompt"
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Select
                        value={selectedVersionByExtensionId[ext.id] ?? ""}
                        onValueChange={(value) =>
                          setSelectedVersionByExtensionId((prev) => ({
                            ...prev,
                            [ext.id]: value,
                          }))
                        }
                        disabled={pending || (versionsByExtensionId[ext.id]?.length ?? 0) === 0}
                      >
                        <SelectTrigger
                          className="h-8 w-[7.5rem] text-xs"
                          aria-label="Version to delete"
                          title="Select a completed detection version to delete"
                        >
                          <SelectValue placeholder="Version" />
                        </SelectTrigger>
                        <SelectContent>
                          {(versionsByExtensionId[ext.id] ?? []).map((item) => (
                            <SelectItem key={item.version} value={item.version}>
                              {item.version}
                              {item.hasStaticCompleted ? "" : " (disk only)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={
                          pending ||
                          !selectedVersionByExtensionId[ext.id] ||
                          (versionsByExtensionId[ext.id]?.length ?? 0) === 0
                        }
                        onClick={() => {
                          const version = selectedVersionByExtensionId[ext.id];
                          if (!version) return;
                          setDeleteTarget({ ext, version });
                        }}
                        aria-label="Delete selected version"
                        title="Delete DB records and extension-data for the selected version"
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

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleteTarget(null);
        }}
        title="Delete version?"
        description={
          deleteTarget
            ? `Delete all data for "${deleteTarget.ext.name}" version ${deleteTarget.version}? This removes database records and files under extension-data and chrome-extension-analyzer for that version. This cannot be undone.`
            : "This action cannot be undone."
        }
        loading={pending}
        onConfirm={confirmDeleteVersion}
      />

      <Dialog
        open={!!editingExtension}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Extension</DialogTitle>
            <DialogDescription>
              Update the display name and the AI browser-test prompt for this extension.
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
                  disabled={pending || promptLoading}
                />
              </div>
              <ExtensionPromptEditor
                value={draftPrompt}
                onChange={setDraftPrompt}
                disabled={pending}
                loading={promptLoading}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={saveExtension} disabled={pending || promptLoading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
