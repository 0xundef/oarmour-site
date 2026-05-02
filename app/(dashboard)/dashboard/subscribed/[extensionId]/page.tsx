import { SubscribedDetectionWorkbench } from "@/components/dashboard/subscribed-detection-workbench";
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

  return (
    <SubscribedDetectionWorkbench
      extensionName={matched?.name || extensionId}
    />
  );
}
