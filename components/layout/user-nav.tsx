"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "next-auth/react";
import { 
  Settings, 
  FileText, 
  MessageSquare, 
  LifeBuoy, 
  LogOut,
  User
} from "lucide-react";
import Link from "next/link";

type UserNavProps = {
  variant?: "header" | "sidebar";
  isMinimized?: boolean;
};

export function UserNav({ variant = "header", isMinimized = false }: UserNavProps) {
  const { data: session } = useSession();

  if (session) {
    const name = session.user?.name || "User";
    const email = session.user?.email || "";
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={
              variant === "sidebar"
                ? `h-11 ${isMinimized ? "w-10 justify-center px-0" : "w-full justify-start gap-2 px-2"} rounded-md`
                : "relative h-8 w-8 rounded-full"
            }
          >
            <Avatar className={variant === "sidebar" ? "h-7 w-7" : "h-8 w-8"}>
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            {variant === "sidebar" && !isMinimized && (
              <span className="truncate text-sm font-medium">{name}</span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align={variant === "sidebar" ? "start" : "end"} forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {name}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem>
              <FileText className="mr-2 h-4 w-4" />
              <span>Documentation</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MessageSquare className="mr-2 h-4 w-4" />
              <span>Give feedback</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LifeBuoy className="mr-2 h-4 w-4" />
              <span>Contact support</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
}
