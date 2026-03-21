 "use client";

import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
const MobileSidebar = dynamic(() => import("./mobile-sidebar").then(m => m.MobileSidebar), { ssr: false });
import Link from "next/link";
import Logo from "@/components/logo";
const GlobalSearch = dynamic(() => import("@/components/global-search").then(m => m.GlobalSearch), { ssr: false });

export default function Header() {
  return (
    <div className="fixed top-0 left-0 right-0 supports-backdrop-blur:bg-background/60 border-b bg-background/95 backdrop-blur z-20">
      <nav className="h-14 flex items-center px-4">
        <div className="hidden lg:block">
          <Link
            href={"/"}
          >
          <Logo/>
          </Link>
        </div>
        <div className={cn("block lg:!hidden")}>
          <MobileSidebar />
        </div>

        <div className="flex-1 flex justify-center px-4">
          <GlobalSearch />
        </div>
      </nav>
    </div>
  );
}
