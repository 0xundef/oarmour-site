"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types";
import { Dispatch, SetStateAction } from "react";

interface DashboardNavProps {
  items: NavItem[];
  setOpen?: Dispatch<SetStateAction<boolean>>;
  isMinimized?: boolean;
}

export function DashboardNav({ items, setOpen, isMinimized = false }: DashboardNavProps) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${path}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  if (!items?.length) {
    return null;
  }

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => {
        const Icon = Icons[item.icon || "arrowRight"];
        const hasChildren = !!item.items?.length;
        const childIsActive = !!item.items?.some((child) => child.href === currentUrl);
        const itemIsActive = item.href === currentUrl || (!item.href && childIsActive) || (item.href === path && !item.href?.includes("?"));
        return (
          <div
            key={index}
            className={cn(
              "space-y-1",
              index > 0 && "mt-2 border-t pt-3"
            )}
          >
            {item.href ? (
              <Link
                href={item.disabled ? "/" : item.href}
                onClick={() => {
                  if (setOpen) setOpen(false);
                }}
              >
                <span
                  className={cn(
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    itemIsActive ? "bg-accent" : "transparent",
                    item.disabled && "cursor-not-allowed opacity-80",
                    isMinimized && "justify-center px-2"
                  )}
                  title={isMinimized ? item.title : undefined}
                >
                  <Icon className={cn("h-4 w-4", !isMinimized && "mr-2")} />
                  {!isMinimized && <span>{item.title}</span>}
                </span>
              </Link>
            ) : hasChildren ? (
              !isMinimized ? (
                <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {item.title}
                </div>
              ) : (
                <div className="space-y-1">
                  {item.items?.map((child) => {
                    const ChildIcon = Icons[child.icon || "arrowRight"];
                    return child.href ? (
                      <Link
                        key={child.href}
                        href={child.disabled ? "/" : child.href}
                        onClick={() => {
                          if (setOpen) setOpen(false);
                        }}
                      >
                        <span
                          className={cn(
                            "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground justify-center px-2",
                            child.href === currentUrl ? "bg-accent" : "transparent",
                            child.disabled && "cursor-not-allowed opacity-80"
                          )}
                          title={child.title}
                        >
                          <ChildIcon className="h-4 w-4" />
                        </span>
                      </Link>
                    ) : null;
                  })}
                </div>
              )
            ) : (
              <span
                className={cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium",
                  isMinimized && "justify-center px-2"
                )}
                title={isMinimized ? item.title : undefined}
              >
                <Icon className={cn("h-4 w-4", !isMinimized && "mr-2")} />
                {!isMinimized && <span>{item.title}</span>}
              </span>
            )}
            {!isMinimized && hasChildren && (
              <div className="space-y-1">
                {item.items?.map((child) => {
                  const ChildIcon = Icons[child.icon || "arrowRight"];
                  return child.href ? (
                    <Link
                      key={child.href}
                      href={child.disabled ? "/" : child.href}
                      onClick={() => {
                        if (setOpen) setOpen(false);
                      }}
                    >
                      <span
                        className={cn(
                          "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                          child.href === currentUrl ? "bg-accent" : "transparent",
                          child.disabled && "cursor-not-allowed opacity-80"
                        )}
                      >
                        <ChildIcon className="mr-2 h-4 w-4" />
                        {child.title}
                      </span>
                    </Link>
                  ) : null;
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
