import SidebarClient from "./sidebar-client";
import { navItems } from "@/constants/data";
import { getCurrentUser } from "@/lib/session";

export default async function Sidebar() {
  const user = await getCurrentUser();

  const finalNavItems = [...navItems];

  if (user?.role === "ADMIN") {
    finalNavItems.push({
      title: "Admin",
      href: "/dashboard/admin",
      icon: "user",
      label: "Admin",
    });
  }

  return <SidebarClient items={finalNavItems} />;
}
