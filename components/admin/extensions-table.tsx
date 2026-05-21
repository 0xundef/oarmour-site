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
  const [deleteTarget, setDeleteTarget] = useState<ExtRow | null>(null);
  const [aiTestingStatusByStoreId, setAiTestingStatusByStoreId] = useState<
    Record<string, AiTestingStatusEntry>
  >({});
  const editingExtension = rows.find((row) => row.id === editingId) ?? null;

  useEffect(() => {
    setRows(extensions);
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
  
  const confirmDeleteExtension = () => {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
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
        setDeleteTarget(null);
        router.refresh();
      } catch {
        toast({ variant: "destructive", description: `Failed to delete ${name}` });
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
            <col className="w-[32rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="w-28 px-4">Version</TableHead>
              <TableHead className="w-48 whitespace-nowrap px-4">Last Update</TableHead>
              <TableHead className="w-[32rem] whitespace-nowrap px-4">Operation</TableHead>
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
                  <TableCell className="w-[32rem] whitespace-nowrap px-4">
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
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={pending}
                        onClick={() => setDeleteTarget(ext)}
                        aria-label="Delete extension"
                        title="Remove this extension from monitoring"
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
        title="Delete extension?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from monitoring? This cannot be undone.`
            : "This action cannot be undone."
        }
        loading={pending}
        onConfirm={confirmDeleteExtension}
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
