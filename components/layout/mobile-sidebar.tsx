"use client";
import { DashboardNav } from "@/components/dashboard-nav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { navItems } from "@/constants/data";
import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { useSession } from "next-auth/react";

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
        { title: "Extensions", href: "/dashboard/admin?section=extensions", icon: "webExtension" },
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
          <div className="space-y-4 py-4">
            <div className="px-3 py-2">
              <div className="space-y-1">
                <DashboardNav items={finalNavItems} setOpen={setOpen} />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
