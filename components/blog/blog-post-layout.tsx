"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BlogTableOfContents } from "@/components/blog/blog-table-of-contents";
import { cn } from "@/lib/utils";
import type { BlogTocItem } from "@/lib/blog-toc";

const TOC_COLLAPSED_STORAGE_KEY = "oarmour-blog-toc-collapsed";

type BlogPostLayoutProps = {
  toc: BlogTocItem[];
  header: ReactNode;
  children: ReactNode;
};

export function BlogPostLayout({ toc, header, children }: BlogPostLayoutProps) {
  const [tocCollapsed, setTocCollapsed] = useState(false);
  const hasToc = toc.length > 0;

  useEffect(() => {
    try {
      setTocCollapsed(localStorage.getItem(TOC_COLLAPSED_STORAGE_KEY) === "true");
    } catch {
      // ignore private browsing / blocked storage
    }
  }, []);

  const toggleToc = () => {
    setTocCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(TOC_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-10 xl:flex-row xl:items-start">
      {hasToc ? (
        <div
          className={cn(
            "not-prose relative hidden shrink-0 xl:flex xl:transition-[width] xl:duration-300 xl:ease-in-out",
            tocCollapsed ? "xl:w-10" : "xl:w-56",
          )}
        >
          <aside
            id="blog-post-toc"
            aria-hidden={tocCollapsed}
            className={cn(
              "sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
              tocCollapsed ? "w-0 opacity-0" : "w-56 opacity-100",
            )}
          >
            <div className="max-h-[calc(100vh-7rem)] overflow-y-auto pr-6">
              <BlogTableOfContents items={toc} />
            </div>
          </aside>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={cn(
                    "absolute top-0 z-10 h-8 w-8 shrink-0 rounded-full border-border bg-background shadow-sm",
                    tocCollapsed ? "left-0" : "-right-3",
                  )}
                  onClick={toggleToc}
                  aria-expanded={!tocCollapsed}
                  aria-controls="blog-post-toc"
                  aria-label={tocCollapsed ? "Show table of contents" : "Hide table of contents"}
                >
                  {tocCollapsed ? (
                    <PanelLeftOpen className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {tocCollapsed ? "Show contents" : "Hide contents"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ) : null}

      <article
        className={cn(
          "prose prose-neutral dark:prose-invert min-w-0 flex-1 transition-[max-width] duration-300 ease-in-out",
          hasToc && !tocCollapsed ? "max-w-3xl" : "max-w-none",
        )}
      >
        {header}

        {hasToc ? (
          <div className="not-prose mb-8 border-b pb-8 xl:hidden">
            <BlogTableOfContents items={toc} />
          </div>
        ) : null}

        {children}
      </article>
    </div>
  );
}
