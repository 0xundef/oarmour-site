"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AiTestingProcedureContent } from "@/components/ai-testing/procedure-content"

type AiTestingRecordingStep = {
  time: string
  thinking: string
  image: string
}

export function AiTestingPublicPage({ extensionId }: { extensionId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [records, setRecords] = useState<AiTestingRecordingStep[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError("")
      try {
        const url = `/ai_testing/${encodeURIComponent(extensionId)}/recordings.json`
        const res = await fetch(url, { cache: "no-store" })
        if (!res.ok) {
          setRecords([])
          setError("No AI testing record found for this extension.")
          return
        }
        const json: unknown = await res.json()
        if (!Array.isArray(json)) {
          setRecords([])
          setError("AI testing record format is invalid.")
          return
        }
        const parsed = json.flatMap((item): AiTestingRecordingStep[] => {
          if (!item || typeof item !== "object") return []
          const obj = item as Record<string, unknown>
          const time = typeof obj.time === "string" ? obj.time : ""
          const thinking = typeof obj.thinking === "string" ? obj.thinking : ""
          const image = typeof obj.image === "string" ? obj.image : ""
          if (!time || !thinking || !image) return []
          return [{ time, thinking, image }]
        })
        setRecords(parsed)
        if (parsed.length === 0) {
          setError("AI testing record is empty.")
        }
      } catch {
        setRecords([])
        setError("Failed to load AI testing record.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [extensionId])

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Testing Procedure</CardTitle>
          <p className="text-sm text-muted-foreground">Step-by-step automated testing record for extension: {extensionId}.</p>
        </CardHeader>
        <CardContent>
          <AiTestingProcedureContent
            extensionId={extensionId}
            records={records}
            loading={loading}
            error={error}
          />
        </CardContent>
      </Card>
    </div>
  )
}

