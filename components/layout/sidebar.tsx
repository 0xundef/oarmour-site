import SidebarClient from "./sidebar-client";
import { navItems } from "@/constants/data";
import { getCurrentUser } from "@/lib/session";

export default async function Sidebar() {
  const user = await getCurrentUser();

  const finalNavItems = [...navItems];

  if (user?.role === "ADMIN") {
    finalNavItems.push({
      title: "Admin",
      icon: "user",
      label: "Admin",
      items: [
        { title: "Users", href: "/dashboard/admin?section=users", icon: "user" },
        { title: "Extensions", href: "/dashboard/admin?section=extensions", icon: "webExtension" },
        { title: "Monitoring", href: "/dashboard/admin?section=monitoring", icon: "monitor" },
      ],
    });
  }

  return <SidebarClient items={finalNavItems} />;
}
