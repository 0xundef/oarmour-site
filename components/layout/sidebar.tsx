import SidebarClient from "./sidebar-client";
import { navItems } from "@/constants/data";
import { getCurrentUser } from "@/lib/session";
import { loadSubscribedNavChildren } from "@/lib/subscribed-nav";

export default async function Sidebar() {
  const user = await getCurrentUser();
  const finalNavItems = [...navItems];

  const subscribedChildren = await loadSubscribedNavChildren({
    id: user?.id,
    email: user?.email,
  });

  finalNavItems.splice(1, 0, {
    title: "Subscribed",
    href: "/dashboard/subscribed",
    icon: "star",
    label: "Subscribed",
    disabled: true,
    tree: true,
    items: subscribedChildren,
  });

  if (user?.role === "ADMIN") {
    finalNavItems.push({
      title: "Admin",
      icon: "user",
      label: "Admin",
      items: [
        { title: "Users", href: "/dashboard/admin?section=users", icon: "user" },
        { title: "Audit", href: "/dashboard/admin?section=audit", icon: "post" },
        { title: "Monitoring", href: "/dashboard/admin?section=monitoring", icon: "monitor" },
      ],
    });
  }

  return <SidebarClient items={finalNavItems} />;
}
