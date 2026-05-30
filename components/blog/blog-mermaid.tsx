"use client";

import { useEffect, useId, useRef, useState } from "react";
import { mermaid as mermaidPlugin } from "@streamdown/mermaid";

let mermaidReady = false;

function renderMermaid(id: string, chart: string) {
  const mermaid = mermaidPlugin.getMermaid({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "strict",
  });

  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      securityLevel: "strict",
    });
    mermaidReady = true;
  }

  return mermaid.render(id, chart);
}

type BlogMermaidProps = {
  chart: string;
};

export function BlogMermaid({ chart }: BlogMermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const renderId = `blog-mermaid-${reactId}-${Math.random().toString(36).slice(2)}`;

    setError(null);
    renderMermaid(renderId, chart.trim())
      .then(({ svg }) => {
        if (cancelled) return;
        container.innerHTML = svg;
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      });

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-muted p-4 text-sm">
        <p className="mb-2 font-medium text-destructive">Diagram failed to render</p>
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex justify-center overflow-x-auto rounded-lg border bg-background p-4 [&_svg]:h-auto [&_svg]:max-w-full"
      aria-label="Diagram"
    />
  );
}
