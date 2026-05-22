"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";

type UserRole = "USER" | "ADMIN";

interface UserRow {
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
  users: UserRow[];
  currentAdminId: string;
}

export function UsersTable({ users, currentAdminId }: UsersTableProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(users);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [draftRole, setDraftRole] = useState<UserRole>("USER");

  useEffect(() => {
    setRows(users);
  }, [users]);

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    setDraftRole(user.role === "ADMIN" ? "ADMIN" : "USER");
  };

  const saveRole = () => {
    if (!editingUser) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: draftRole }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            typeof payload?.error === "string" ? payload.error : "Failed to update role";
          throw new Error(message);
        }
        setRows((prev) =>
          prev.map((row) =>
            row.id === editingUser.id ? { ...row, role: draftRole } : row,
          ),
        );
        toast({ description: `Role updated to ${draftRole}` });
        setEditingUser(null);
        router.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update role";
        toast({ variant: "destructive", description: message });
      }
    });
  };

  const isSelf = editingUser?.id === currentAdminId;

  return (
    <>
      <div className="rounded-md border">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[12%]" />
            <col />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[10rem]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Name</TableHead>
              <TableHead className="px-4">Email</TableHead>
              <TableHead className="px-4">Role</TableHead>
              <TableHead className="px-4 text-right">Submissions</TableHead>
              <TableHead className="px-4 text-right">Subscriptions</TableHead>
              <TableHead className="whitespace-nowrap px-4">Joined</TableHead>
              <TableHead className="whitespace-nowrap px-4">Operation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((user) => (
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
                  <TableCell className="px-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => openEdit(user)}
                      aria-label={`Edit role for ${user.email}`}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open && !pending) setEditingUser(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user role</DialogTitle>
            <DialogDescription>
              {editingUser
                ? `Set role for ${editingUser.name || editingUser.email}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="user-role-select">Role</Label>
            <Select
              value={draftRole}
              onValueChange={(value) => setDraftRole(value as UserRole)}
              disabled={pending || (isSelf && draftRole === "ADMIN")}
            >
              <SelectTrigger id="user-role-select">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Regular user</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            {isSelf ? (
              <p className="text-xs text-muted-foreground">
                You cannot change your own role away from Admin.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEditingUser(null)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={saveRole}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
