"use client";
import { DashboardNav } from "@/components/dashboard-nav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { buildDashboardNavItems } from "@/lib/dashboard-nav-items";
import {
  patchNavItemsWithSubscribedChildren,
  SUBSCRIPTIONS_NAV_REFRESH_EVENT,
} from "@/lib/subscriptions-nav-events";
import type { NavItem } from "@/types";
import { MenuIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { UserNav } from "./user-nav";

type SidebarProps = React.HTMLAttributes<HTMLDivElement>

export function MobileSidebar({ className }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [navItemsState, setNavItemsState] = useState<NavItem[]>(() =>
    buildDashboardNavItems({ isAdmin }),
  );

  useEffect(() => {
    setNavItemsState(buildDashboardNavItems({ isAdmin }));
  }, [isAdmin]);

  const refreshSubscribedNav = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/subscriptions", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: NavItem[] };
      if (!Array.isArray(data.items)) return;
      setNavItemsState((prev) => patchNavItemsWithSubscribedChildren(prev, data.items));
    } catch {
      // Keep current nav if refresh fails.
    }
  }, []);

  useEffect(() => {
    void refreshSubscribedNav();
  }, [refreshSubscribedNav]);

  useEffect(() => {
    const handler = () => {
      void refreshSubscribedNav();
    };
    window.addEventListener(SUBSCRIPTIONS_NAV_REFRESH_EVENT, handler);
    return () => window.removeEventListener(SUBSCRIPTIONS_NAV_REFRESH_EVENT, handler);
  }, [refreshSubscribedNav]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <MenuIcon />
        </SheetTrigger>
        <SheetContent side="left" className="!px-0">
          <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto py-4">
              <div className="px-3 py-2">
                <div className="space-y-1">
                  <DashboardNav items={navItemsState} setOpen={setOpen} />
                </div>
              </div>
            </div>
            <div className="border-t px-3 py-3">
              <UserNav variant="sidebar" />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
