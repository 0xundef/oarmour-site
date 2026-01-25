"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateSubmissionStatus } from "@/app/actions/update-submission";
import { useToast } from "@/components/ui/use-toast";
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
  const { toast } = useToast();

  async function handleStatusUpdate(id: string, status: "APPROVED" | "REJECTED") {
    const result = await updateSubmissionStatus(id, status);

    if (result?.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Submission ${status.toLowerCase()}.`,
      });
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Input</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
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
                <TableCell className="text-right space-x-2">
                  {submission.status === "PENDING" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusUpdate(submission.id, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleStatusUpdate(submission.id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
