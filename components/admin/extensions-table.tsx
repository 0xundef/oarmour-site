"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useTransition } from "react";

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
      } catch (e) {
        toast({ variant: "destructive", description: "Failed to update monitoring setting" });
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
            <TableHead>Monitored</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {extensions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No extensions found.
              </TableCell>
            </TableRow>
          ) : (
            extensions.map((ext) => (
              <TableRow key={ext.id}>
                <TableCell>{ext.name}</TableCell>
                <TableCell className="font-mono text-xs">{ext.storeId}</TableCell>
                <TableCell>{ext.version || "N/A"}</TableCell>
                <TableCell>
                  <Switch
                    checked={!!ext.isMonitored}
                    onCheckedChange={(v) => toggleMonitor(ext.id, v)}
                    disabled={pending}
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
