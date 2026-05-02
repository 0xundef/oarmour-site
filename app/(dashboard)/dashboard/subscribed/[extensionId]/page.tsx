import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SubscribedExtensionPage({
  params: _params,
}: {
  params: Promise<{ extensionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="flex-1 p-4 md:px-8 md:pb-8 md:pt-4" />
  );
}
