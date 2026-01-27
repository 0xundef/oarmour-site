"use client"

import * as React from "react"
import {
  PlusIcon,
} from "@radix-ui/react-icons"
import { useRouter } from "next/navigation"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useToast } from "@/components/ui/use-toast"

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const router = useRouter()
  const { toast } = useToast()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // removed unused runCommand

  const extractExtensionId = (input: string): string | null => {
    const trimmed = input.trim()
    const idRegex = /^[a-z]{32}$/
    if (idRegex.test(trimmed)) return trimmed
    try {
      const url = new URL(trimmed)
      const host = url.hostname
      const path = url.pathname
      const isChromeWebStore =
        host.includes("chromewebstore.google.com") ||
        (host.includes("chrome.google.com") && path.includes("/webstore/"))
      if (isChromeWebStore && path.includes("/detail/")) {
        const match = path.match(/[a-z]{32}/)
        if (match) return match[0]
      }
    } catch {
      // not a valid URL, fall through
    }
    return null
  }

  const handleSubmit = async () => {
    if (!query) return;
    const extensionId = extractExtensionId(query);
    if (!extensionId) {
        toast({
            variant: "destructive",
            title: "输入不合法",
            description: "请输入 32 位插件 ID 或 Chrome Web Store 链接。",
        });
        return;
    }

    setOpen(false);
    toast({
        title: "Analysis Queued",
        description: "Request submitted. Analyzing in background...",
    });

    try {
        const res = await fetch('/api/extensions/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extensionId })
        });

        if (!res.ok) throw new Error('Failed to start analysis');
        
        const data = await res.json();
        
        toast({
            title: "Analysis Started",
            description: `Processing extension: ${data.data.name || extensionId}`,
        });
        
        // Maybe refresh dashboard data?
        router.refresh();

    } catch {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to submit extension for analysis."
        });
    }
  }

  return (
    <>
      <button
        className="inline-flex items-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-80 lg:w-[32rem]"
        onClick={() => setOpen(true)}
      >
        <span className="hidden lg:inline-flex">Search extension ID or URL...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
            placeholder="Type extension ID to analyze..." 
            value={query}
            onValueChange={setQuery}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    handleSubmit();
                }
            }}
        />
        <CommandList>
          <CommandEmpty>
            Press Enter to analyze extension ID.
          </CommandEmpty>
          <CommandGroup heading="Quick Actions">
             <CommandItem onSelect={handleSubmit}>
              <PlusIcon className="mr-2 h-4 w-4" />
              <span>Analyze Extension: {extractExtensionId(query) || query || "..."}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
