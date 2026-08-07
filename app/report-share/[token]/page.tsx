import { PipelineReportPublicSharePage } from "@/components/dashboard/pipeline-report-share-page"

export default async function ReportSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <PipelineReportPublicSharePage shareToken={decodeURIComponent(token)} />
}
