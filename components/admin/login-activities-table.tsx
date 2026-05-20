"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LoginActivityRow {
  id: string;
  ipAddress: string | null;
  provider: string | null;
  createdAt: Date;
  user: {
    email: string;
    name: string | null;
  };
}

interface LoginActivitiesTableProps {
  activities: LoginActivityRow[];
}

function formatAuditTime(value: Date) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatProvider(provider: string | null) {
  if (!provider) return "—";
  if (provider === "credentials") return "Email";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export function LoginActivitiesTable({ activities }: LoginActivitiesTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Login Time</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Method</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No login activity recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            activities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{activity.user.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{activity.user.email}</span>
                  </div>
                </TableCell>
                <TableCell>{formatAuditTime(activity.createdAt)}</TableCell>
                <TableCell className="font-mono text-sm">
                  {activity.ipAddress || "—"}
                </TableCell>
                <TableCell>{formatProvider(activity.provider)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
