import { ThreatAlerts } from "@/components/dashboard/threat-alerts";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function page() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/signin");
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-2 md:px-8 md:pb-8 md:pt-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-7">
          <ThreatAlerts />
        </div>
      </div>
    </div>
  );
}
