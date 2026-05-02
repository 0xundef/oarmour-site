"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CheckItem = {
  id: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  file: string;
  summary: string;
  conditions: string[];
  impact: string;
};

const MOCK_ITEMS: CheckItem[] = [
  {
    id: 470,
    severity: "CRITICAL",
    title: "Remote script chain may lead to payload execution",
    file: "background.js",
    summary:
      "The extension loads remote JavaScript from a third-party endpoint and executes it in a privileged runtime context.",
    conditions: [
      "Attacker controls or hijacks the remote script endpoint.",
      "Extension runs with elevated permissions and no signature pinning.",
      "Runtime allows dynamic code path execution.",
    ],
    impact:
      "Potential arbitrary code execution in extension context, token/session theft, and malicious request replay.",
  },
  {
    id: 198,
    severity: "HIGH",
    title: "Excessive host permissions with broad wildcard scope",
    file: "manifest.json",
    summary:
      "Host permissions include broad wildcard patterns not limited to explicit business domains.",
    conditions: [
      "User installs extension and grants default permissions.",
      "Injected content scripts run on wildcard-matched pages.",
    ],
    impact:
      "Large attack surface and elevated risk of unintended data collection or page manipulation.",
  },
  {
    id: 133,
    severity: "MEDIUM",
    title: "Clipboard write behavior observed in non-user-initiated flow",
    file: "popup.js",
    summary:
      "Clipboard write operations were triggered during scripted dynamic testing flows without strong user-intent checks.",
    conditions: [
      "Popup flow is opened and extension state machine transitions automatically.",
      "Clipboard APIs are available in runtime context.",
    ],
    impact: "Potential social engineering and content replacement risks.",
  },
  {
    id: 88,
    severity: "LOW",
    title: "Manifest metadata quality issue",
    file: "manifest.json",
    summary:
      "Policy and transparency metadata is incomplete for reviewer and user trust checks.",
    conditions: [
      "Metadata fields remain empty in package builds.",
    ],
    impact: "Lower trust and reduced auditability; no direct exploit path confirmed.",
  },
];

function severityClass(level: CheckItem["severity"]) {
  if (level === "CRITICAL") return "bg-red-500 text-white";
  if (level === "HIGH") return "bg-orange-500 text-white";
  if (level === "MEDIUM") return "bg-yellow-500 text-white";
  return "bg-slate-500 text-white";
}

export function SubscribedDetectionWorkbench({
  extensionName,
}: {
  extensionName: string;
}) {
  const [activeId, setActiveId] = useState<number>(MOCK_ITEMS[0].id);
  const active = useMemo(
    () => MOCK_ITEMS.find((item) => item.id === activeId) || MOCK_ITEMS[0],
    [activeId],
  );

  return (
    <div className="flex-1 p-4 md:px-8 md:pb-8 md:pt-4">
      <div className="mb-3">
        <div className="text-2xl font-semibold">{extensionName}</div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid min-h-[72vh] grid-cols-1 lg:grid-cols-[340px_1fr]">
            <aside className="border-r bg-muted/20">
              <div className="border-b p-3">
                <div className="text-sm font-semibold">Check Items</div>
                <div className="text-xs text-muted-foreground">{MOCK_ITEMS.length} findings</div>
              </div>
              <div className="max-h-[72vh] overflow-y-auto p-2">
                {MOCK_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveId(item.id)}
                    className={cn(
                      "mb-2 w-full rounded-md border p-3 text-left hover:bg-accent",
                      item.id === active.id ? "border-primary bg-accent" : "bg-background",
                    )}
                  >
                    <div className="mb-1 text-xs text-muted-foreground">#{item.id}</div>
                    <div className="mb-1 line-clamp-2 text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.file}</div>
                  </button>
                ))}
              </div>
            </aside>

            <section className="p-5 lg:p-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-2xl font-semibold">#{active.id}</span>
                <Badge className={severityClass(active.severity)}>{active.severity}</Badge>
              </div>
              <h2 className="mb-4 text-3xl font-bold">{active.title}</h2>

              <div className="mb-5">
                <div className="mb-1 text-sm font-semibold text-muted-foreground">Summary</div>
                <p className="text-base leading-7">{active.summary}</p>
              </div>

              <div className="mb-5">
                <div className="mb-1 text-sm font-semibold text-muted-foreground">Conditions</div>
                <ul className="list-disc space-y-1 pl-5 text-base">
                  {active.conditions.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="mb-1 text-sm font-semibold text-muted-foreground">Impact</div>
                <p className="text-base leading-7">{active.impact}</p>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
