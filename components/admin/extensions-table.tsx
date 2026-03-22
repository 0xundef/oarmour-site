"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useEffect, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Copy, Trash2 } from "lucide-react";

type ExtRow = {
  id: string;
  name: string;
  storeId: string;
  version: string | null;
  isMonitored?: boolean;
  checkFrequencyMinutes?: number;
};

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

  const copyExtensionId = async (storeId: string) => {
    try {
      await navigator.clipboard.writeText(storeId);
      toast({ description: "Extension ID copied to clipboard" });
    } catch {
      toast({ variant: "destructive", description: "Failed to copy extension ID" });
    }
  };

  return (
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
                <TableCell className="flex items-center gap-3">
                  <Switch
                    checked={!!ext.isMonitored}
                    onCheckedChange={(v) => toggleMonitor(ext.id, v)}
                    disabled={pending}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={pending}
                    onClick={() => copyExtensionId(ext.storeId)}
                    aria-label="Copy extension ID"
                    title="Copy extension ID"
                  >
                    <Copy className="h-4 w-4" />
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
