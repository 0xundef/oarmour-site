import ThemeToggle from "@/components/layout/ThemeToggle/theme-toggle";
import { cn } from "@/lib/utils";
import { MobileSidebar } from "./mobile-sidebar";
import { UserNav } from "./user-nav";
import Link from "next/link";
import Logo from "@/components/logo";

export default function Header() {
  return (
    <div className="fixed top-0 left-0 right-0 supports-backdrop-blur:bg-background/60 border-b bg-background/95 backdrop-blur z-20">
      <nav className="h-14 flex items-center justify-between px-4">
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
     
        <div className="flex items-center gap-2">
        <Link
          href={"https://zccobra.notion.site/OAmour-88a311d5d637490b8490afd207ae4046?pvs=4"}
            target="_blank"
          >
            Blog
          </Link>
          <UserNav />
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}