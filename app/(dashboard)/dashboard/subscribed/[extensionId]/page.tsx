import { SubscribedDetectionWorkbench } from "@/components/dashboard/subscribed-detection-workbench";
import { prisma } from "@/lib/prisma";
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

  const { extensionId: rawExtensionId } = await params;
  const storeId = decodeURIComponent(rawExtensionId);
  const extension = await prisma.globalExtension.findFirst({
    where: { storeId },
    select: { name: true, version: true },
  });
  const extensionName = extension?.name?.trim() || storeId;
  const extensionVersion = extension?.version?.trim() || null;

  return (
    <SubscribedDetectionWorkbench
      storeId={storeId}
      extensionName={extensionName}
      extensionVersion={extensionVersion}
    />
  );
}
