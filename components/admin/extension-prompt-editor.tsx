"use client"

import { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ExtensionPromptEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  loading?: boolean
}

export function ExtensionPromptEditor({
  value,
  onChange,
  disabled,
  loading,
}: ExtensionPromptEditorProps) {
  const preview = useMemo(() => value || "_No prompt content yet._", [value])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">AI test prompt (prompt.md)</p>
        <p className="text-xs text-muted-foreground">Markdown · used by browser agent</p>
      </div>
      <Tabs defaultValue="preview" className="w-full">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="mt-3">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || loading}
            placeholder="Write extension-specific test instructions in Markdown…"
            className="min-h-[360px] font-mono text-sm leading-relaxed"
            spellCheck={false}
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-3">
          <div className="min-h-[360px] max-h-[360px] overflow-y-auto rounded-md border bg-muted/20 px-4 py-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading prompt…</p>
            ) : (
              <article className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview}</ReactMarkdown>
              </article>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
