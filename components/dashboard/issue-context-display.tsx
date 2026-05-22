import type { ReactNode } from "react"
import { formatFindingRunLabel } from "@/lib/format-finding-run-time"
import type { WorkbenchCheckItem } from "@/lib/workbench-check-items"

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-semibold text-foreground">{children}</span>
  )
}

export function IssueContextDisplay({ issue }: { issue: WorkbenchCheckItem }) {
  return (
    <div className="space-y-3 text-sm leading-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Finding details (conversation context)
      </p>

      <div>
        <Label>Title</Label>
        <p className="mt-0.5 font-medium">{issue.title}</p>
      </div>

      <p className="text-muted-foreground">
        <Label>Severity</Label> {issue.severity}
        <span className="mx-1.5 text-muted-foreground/50">·</span>
        <Label>Source</Label> {issue.source}
        <span className="mx-1.5 text-muted-foreground/50">·</span>
        <Label>Category</Label> {issue.category}
      </p>

      <p className="text-muted-foreground">
        <Label>Scan batch</Label> {formatFindingRunLabel(issue.source, issue.detectedAt)}
      </p>

      <p className="text-muted-foreground">
        <Label>File</Label> <span className="text-foreground">{issue.file}</span>
      </p>

      <div>
        <Label>Summary</Label>
        <p className="mt-1 text-foreground">{issue.summary}</p>
      </div>

      <div>
        <Label>Conditions</Label>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
          {issue.conditions.length > 0 ? (
            issue.conditions.map((line) => <li key={line}>{line}</li>)
          ) : (
            <li className="text-muted-foreground">(none listed)</li>
          )}
        </ul>
      </div>

      <div>
        <Label>Impact</Label>
        <p className="mt-1 text-foreground">{issue.impact}</p>
      </div>
    </div>
  )
}
