"use client";

import { DashboardNav } from "@/components/dashboard-nav";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserNav } from "./user-nav";

interface SidebarClientProps {
  items: NavItem[];
}

export default function SidebarClient({ items }: SidebarClientProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleSidebar = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <nav
      className={cn(
        "relative hidden h-screen border-r pt-16 lg:block transition-all duration-300",
        isMinimized ? "w-16" : "w-56"
      )}
    >
      <div className="absolute right-[-12px] top-20 z-20">
        <Button
          variant="secondary"
          className="h-6 w-6 rounded-full p-0 shadow-md"
          onClick={toggleSidebar}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300",
              isMinimized && "rotate-180"
            )}
          />
        </Button>
      </div>

      <div className="flex h-[calc(100vh-4rem)] flex-col">
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="px-3 py-2">
            <div className="space-y-1">
              <DashboardNav items={items} isMinimized={isMinimized} />
            </div>
          </div>
        </div>
        <div className="border-t px-3 py-3">
          <UserNav variant="sidebar" isMinimized={isMinimized} />
        </div>
      </div>
    </nav>
  );
}
