import { AiTestingPublicPage } from "@/components/ai-testing/public-page"

export default function AiTestingDetailPage({
  params,
}: {
  params: Promise<{ extensionId: string }>
}) {
  return (
    <AiTestingDetailPageInner params={params} />
  )
}

async function AiTestingDetailPageInner({
  params,
}: {
  params: Promise<{ extensionId: string }>
}) {
  const { extensionId } = await params
  return <AiTestingPublicPage extensionId={decodeURIComponent(extensionId)} />
}
