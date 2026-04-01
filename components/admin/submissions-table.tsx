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

interface Submission {
  id: string;
  input: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  user: {
    email: string;
    name: string | null;
  };
}

interface SubmissionsTableProps {
  submissions: Submission[];
}

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Input</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center">
                No submissions found.
              </TableCell>
            </TableRow>
          ) : (
            submissions.map((submission) => (
              <TableRow key={submission.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{submission.user.name || "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{submission.user.email}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={submission.input}>
                  {submission.input}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      submission.status === "APPROVED"
                        ? "default"
                        : submission.status === "REJECTED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {submission.status}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(submission.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
