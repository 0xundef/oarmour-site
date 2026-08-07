import SidebarClient from "./sidebar-client";
import { buildDashboardNavItems } from "@/lib/dashboard-nav-items";
import { getCurrentUser } from "@/lib/session";

export default async function Sidebar() {
  const user = await getCurrentUser();

  const finalNavItems = buildDashboardNavItems({
    isAdmin: user?.role === "ADMIN",
  });

  return <SidebarClient items={finalNavItems} />;
}
