import { InvestigationPublicSharePage } from "@/components/investigation/public-share-page"

export default async function InvestigationSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <InvestigationPublicSharePage shareToken={decodeURIComponent(token)} />
}
