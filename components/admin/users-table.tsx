"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  submissions: {
    id: string;
    status: string;
  }[];
  _count: {
    notificationSubscriptions: number;
  };
}

interface UsersTableProps {
  users: User[];
}

export function UsersTable({ users }: UsersTableProps) {
  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-[14%]" />
          <col />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[15%]" />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead className="px-4">Name</TableHead>
            <TableHead className="px-4">Email</TableHead>
            <TableHead className="px-4">Role</TableHead>
            <TableHead className="px-4 text-right">Submissions</TableHead>
            <TableHead className="px-4 text-right">Subscriptions</TableHead>
            <TableHead className="whitespace-nowrap px-4">Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center">
                No users found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="truncate px-4" title={user.name || "Unknown"}>
                  {user.name || "Unknown"}
                </TableCell>
                <TableCell className="truncate px-4" title={user.email}>
                  {user.email}
                </TableCell>
                <TableCell className="px-4">
                  <Badge variant="outline">{user.role}</Badge>
                </TableCell>
                <TableCell className="px-4 text-right tabular-nums">
                  {user.submissions.length}
                </TableCell>
                <TableCell className="px-4 text-right tabular-nums">
                  {user._count.notificationSubscriptions}
                </TableCell>
                <TableCell className="whitespace-nowrap px-4 text-muted-foreground">
                  {formatDate(user.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
