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
import { ExtensionPromptEditor } from "@/components/admin/extension-prompt-editor";

type ExtRow = {
  id: string;
  name: string;
  storeId: string;
  version: string | null;
  isMonitored?: boolean;
  testingMode?: boolean;
  checkFrequencyMinutes?: number;
  promptMarkdown?: string | null;
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
  const [draftPrompt, setDraftPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
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

  const runImmediateCheck = (ext: ExtRow) => {
    if (!ext.isMonitored) {
      toast({ variant: "destructive", description: "Monitoring is not enabled for this extension. Enable it first." });
      return;
    }
    startTransition(async () => {
      try {
        const nextVersion = getNextVersion(ext.version) ?? "{next-version}";
        const downloadUri = `https://cdn.oarmour.com/${ext.storeId}/${nextVersion}.zip`;
        console.info("[monitor-check] next download uri:", downloadUri);
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
                      <span title="Turn version monitoring on or off for this extension">
                        <Switch
                          checked={!!ext.isMonitored}
                          onCheckedChange={(v) => toggleMonitor(ext.id, v)}
                          disabled={pending}
                          aria-label="Toggle monitoring"
                        />
                      </span>
                      <span title="Turn AI browser testing on or off for this extension">
                        <Switch
                          checked={!!ext.testingMode}
                          onCheckedChange={(v) => toggleTestingMode(ext.id, v)}
                          disabled={pending}
                          aria-label="Toggle testing mode"
                        />
                      </span>
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
                        onClick={() => deleteExtension(ext.id)}
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
