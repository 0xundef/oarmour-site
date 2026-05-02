import SidebarClient from "./sidebar-client";
import { navItems } from "@/constants/data";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function Sidebar() {
  const user = await getCurrentUser();
  const finalNavItems = [...navItems];
  const notificationSubscriptionModel = (prisma as unknown as {
    notificationSubscription?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        extension: { storeId: string; name: string }
      }>>
    }
  }).notificationSubscription

  const subscribedChildren = notificationSubscriptionModel
    ? await notificationSubscriptionModel.findMany({
        where: user?.email
          ? {
              user: {
                email: {
                  equals: user.email.trim(),
                  mode: "insensitive",
                },
              },
            }
          : user?.id
            ? { userId: user.id }
            : { userId: "__no_user__" },
        orderBy: { createdAt: "desc" },
        select: {
          extension: {
            select: { storeId: true, name: true },
          },
        },
      })
    : []

  finalNavItems.splice(1, 0, {
    title: "Subscribed",
    href: "/dashboard/extension?view=subscribed",
    icon: "star",
    label: "Subscribed",
    tree: true,
    items:
      subscribedChildren.length > 0
        ? subscribedChildren.map((item) => ({
            title: item.extension.name || item.extension.storeId,
            href: `/dashboard/extension?search=${encodeURIComponent(item.extension.storeId)}`,
            icon: "check",
          }))
        : [
            {
              title: "No subscriptions",
              href: "/dashboard/extension",
              icon: "arrowRight",
              disabled: true,
            },
          ],
  });

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
