"use client";
import { DashboardNav } from "@/components/dashboard-nav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { buildDashboardNavItems } from "@/lib/dashboard-nav-items";
import type { NavItem } from "@/types";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { UserNav } from "./user-nav";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [navItemsState, setNavItemsState] = useState<NavItem[]>(() =>
    buildDashboardNavItems({ isAdmin }),
  );

  useEffect(() => {
    setNavItemsState(buildDashboardNavItems({ isAdmin }));
  }, [isAdmin]);

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
