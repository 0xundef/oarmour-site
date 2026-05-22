import SidebarClient from "./sidebar-client";
import { navItems } from "@/constants/data";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { countHighCriticalFindingsForSubscribed } from "@/lib/subscribed-finding-count";

export default async function Sidebar() {
  const user = await getCurrentUser();
  const finalNavItems = [...navItems];
  const notificationSubscriptionModel = (prisma as unknown as {
    notificationSubscription?: {
      findMany: (...args: unknown[]) => Promise<Array<{
        extension: { storeId: string; name: string; version: string | null }
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
            select: { storeId: true, name: true, version: true },
          },
        },
      })
    : []

  finalNavItems.splice(1, 0, {
    title: "Subscribed",
    href: "/dashboard/subscribed",
    icon: "star",
    label: "Subscribed",
    disabled: true,
    tree: true,
    items:
      subscribedChildren.length > 0
        ? await Promise.all(
            subscribedChildren.map(async (item) => ({
              title: item.extension.name || item.extension.storeId,
              href: `/dashboard/subscribed/${encodeURIComponent(item.extension.storeId)}`,
              icon: "check" as const,
              highCriticalCount: await countHighCriticalFindingsForSubscribed(
                item.extension.storeId,
                item.extension.version,
              ),
            })),
          )
        : [
            {
              title: "No subscriptions",
              href: "/dashboard/subscribed",
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
        { title: "Audit", href: "/dashboard/admin?section=audit", icon: "post" },
        { title: "Monitoring", href: "/dashboard/admin?section=monitoring", icon: "monitor" },
      ],
    });
  }

  return <SidebarClient items={finalNavItems} />;
}
