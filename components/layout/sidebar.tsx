import SidebarClient from "./sidebar-client";
import { buildDashboardNavItems } from "@/lib/dashboard-nav-items";
import { getCurrentUser } from "@/lib/session";
import { loadSubscribedNavChildren } from "@/lib/subscribed-nav";

export default async function Sidebar() {
  const user = await getCurrentUser();

  const subscribedChildren = await loadSubscribedNavChildren({
    id: user?.id,
    email: user?.email,
  });

  const finalNavItems = buildDashboardNavItems({
    subscribedChildren,
    isAdmin: user?.role === "ADMIN",
  });

  return <SidebarClient items={finalNavItems} />;
}
