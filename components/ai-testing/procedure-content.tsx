type AiTestingRecordingStep = {
  time: string
  thinking: string
  image: string
}

export function AiTestingProcedureContent(props: {
  extensionId: string
  records: AiTestingRecordingStep[]
  loading: boolean
  error: string
}) {
  const { extensionId, records, loading, error } = props

  if (loading) {
    return <div className="py-6 text-sm text-muted-foreground">Loading AI testing record...</div>
  }

  if (error) {
    return <div className="py-6 text-sm text-muted-foreground">{error}</div>
  }

  return (
    <div className="space-y-4">
      {records.map((step, idx) => {
        const imagePath = `/ai_testing/${extensionId}/${step.image.replace(/^\/+/, "")}`
        return (
          <div key={`${step.time}-${idx}`} className="rounded-md border p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              Step {idx + 1} · {step.time}
            </div>
            <div className="mb-3 text-sm leading-relaxed">{step.thinking}</div>
            <img
              src={imagePath}
              alt={`AI testing step ${idx + 1}`}
              className="w-full rounded border object-contain"
              loading="lazy"
            />
          </div>
        )
      })}
    </div>
  )
}

