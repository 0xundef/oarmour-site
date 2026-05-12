"use client";
import { DashboardNav } from "@/components/dashboard-nav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { navItems } from "@/constants/data";
import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { UserNav } from "./user-nav";

// import { Playlist } from "../data/playlists";

type SidebarProps = React.HTMLAttributes<HTMLDivElement>

export function MobileSidebar({ className }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const finalNavItems = [...navItems];
  if (session?.user?.role === "ADMIN") {
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
                  <DashboardNav items={finalNavItems} setOpen={setOpen} />
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
