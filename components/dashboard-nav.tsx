"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/utils";
import { NavItem } from "@/types";
import { Dispatch, SetStateAction, useState } from "react";

interface DashboardNavProps {
  items: NavItem[];
  setOpen?: Dispatch<SetStateAction<boolean>>;
  isMinimized?: boolean;
}

export function DashboardNav({ items, setOpen, isMinimized = false }: DashboardNavProps) {
  const path = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${path}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  if (!items?.length) {
    return null;
  }

  return (
    <nav className="grid items-start gap-2">
      {items.map((item, index) => {
        const Icon = Icons[item.icon || "arrowRight"];
        const hasChildren = !!item.items?.length;
        const treeMode = !!item.tree;
        const childIsActive = !!item.items?.some((child) => child.href === currentUrl);
        const groupKey = item.href || item.title;
        const isCollapsed = treeMode && !childIsActive ? collapsedGroups[groupKey] ?? false : false;
        const itemIsActive = item.href === currentUrl || (!item.href && childIsActive) || (item.href === path && !item.href?.includes("?"));

        return (
          <div
            key={index}
            className={cn(
              "space-y-1",
              index > 0 && "mt-2 border-t pt-3"
            )}
          >
            {item.href && !(treeMode && hasChildren) ? (
              <Link
                href={item.disabled ? "/" : item.href}
                onClick={(e) => {
                  if (item.disabled) {
                    e.preventDefault();
                    return;
                  }
                  if (setOpen) setOpen(false);
                }}
              >
                <span
                  className={cn(
                    "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                    itemIsActive ? "bg-accent" : "transparent",
                    item.disabled && "opacity-80",
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
                treeMode ? (
                  <button
                    type="button"
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    onClick={() => {
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [groupKey]: !(prev[groupKey] ?? false),
                      }));
                    }}
                    aria-expanded={!isCollapsed}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                  </button>
                ) : (
                  <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {item.title}
                  </div>
                )
              ) : treeMode ? (
                <span
                  className="group flex items-center justify-center rounded-md px-2 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  title={item.title}
                >
                  <Icon className="h-4 w-4" />
                </span>
              ) : (
                <div className="space-y-1">
                  {item.items?.map((child) => {
                    const ChildIcon = Icons[child.icon || "arrowRight"];
                    return child.href ? (
                      <Link
                        key={child.href}
                        href={child.disabled ? "/" : child.href}
                        onClick={(e) => {
                          if (child.disabled) {
                            e.preventDefault();
                            return;
                          }
                          if (setOpen) setOpen(false);
                        }}
                      >
                        <span
                          className={cn(
                            "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground justify-center px-2",
                            child.href === currentUrl ? "bg-accent" : "transparent",
                            child.disabled && "opacity-80"
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
            {!isMinimized && hasChildren && !isCollapsed && (
              <div
                className={cn(
                  "space-y-1",
                  treeMode && "ml-6 border-l border-border/80 pl-3"
                )}
              >
                {item.items?.map((child) => {
                  const ChildIcon = Icons[child.icon || "arrowRight"];
                  return child.href ? (
                    <Link
                      key={child.href}
                      href={child.disabled ? "/" : child.href}
                      onClick={(e) => {
                        if (child.disabled) {
                          e.preventDefault();
                          return;
                        }
                        if (setOpen) setOpen(false);
                      }}
                    >
                      <span
                        className={cn(
                          "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                          treeMode && "px-2 py-1.5 text-[13px]",
                          child.href === currentUrl ? "bg-accent" : "transparent",
                          child.disabled && "opacity-80"
                        )}
                      >
                        <ChildIcon className={cn("mr-2 h-4 w-4", treeMode && "h-3.5 w-3.5 text-emerald-500")} />
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
