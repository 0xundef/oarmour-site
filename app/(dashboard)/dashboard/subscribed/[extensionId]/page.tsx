import { SubscribedExtensionDetail } from "@/components/dashboard/subscribed-extension-detail";
import { getExtensions } from "@/app/actions/get-extensions";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SubscribedExtensionPage({
  params,
}: {
  params: Promise<{ extensionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin");
  }

  const { extensionId } = await params;
  const all = await getExtensions();
  const matched = all.find((item) => item.storeId === extensionId);

  if (!matched) {
    redirect("/dashboard/subscribed");
  }

  return (
    <SubscribedExtensionDetail
      extensionId={matched.storeId}
      extensionName={matched.name}
      version={matched.version || "N/A"}
      lastUpdate={new Date(matched.updatedAt).toLocaleDateString()}
      analysisStatus={matched.analysisStatus}
      risk={matched.riskLevel}
    />
  );
}
