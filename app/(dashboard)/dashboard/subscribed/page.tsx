import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function SubscribedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-2 md:px-8 md:pb-8 md:pt-4">
      <div className="rounded-md border p-6 text-sm text-muted-foreground">
        Select one extension under <span className="font-medium text-foreground">Subscribed</span> to view the latest detection result page.
      </div>
    </div>
  );
}
