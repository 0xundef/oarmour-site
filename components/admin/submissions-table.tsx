"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Submission {
  id: string;
  input: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    email: string;
    name: string | null;
  };
}

interface SubmissionsTableProps {
  submissions: Submission[];
}

function resolveChromeExtensionId(input: string) {
  const trimmed = input.trim();
  const detailMatch = trimmed.match(/chromewebstore\.google\.com\/detail\/(?:[^/]+\/)?([a-z]{32})(?:[/?#]|$)/i);
  if (detailMatch?.[1]) return detailMatch[1].toLowerCase();
  const idMatch = trimmed.match(/^[a-z]{32}$/i);
  return idMatch ? idMatch[0].toLowerCase() : null;
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

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Submitted Extension</TableHead>
            <TableHead>Submitted At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                No user-submitted extension operations found.
              </TableCell>
            </TableRow>
          ) : (
            submissions.map((submission) => {
              const extensionId = resolveChromeExtensionId(submission.input);
              const href = extensionId ? `https://chromewebstore.google.com/detail/${extensionId}` : null;

              return (
                <TableRow key={submission.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{submission.user.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">{submission.user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate" title={submission.input}>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {submission.input}
                      </a>
                    ) : (
                      submission.input
                    )}
                  </TableCell>
                  <TableCell>{formatAuditTime(submission.createdAt)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
