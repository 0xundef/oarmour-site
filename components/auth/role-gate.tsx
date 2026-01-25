"use client";

import { useSession } from "next-auth/react";
type UserRole = "ADMIN" | "USER";

interface RoleGateProps {
  children: React.ReactNode;
  allowedRole: UserRole;
}

export const RoleGate = ({ children, allowedRole }: RoleGateProps) => {
  const { data: session } = useSession();

  if (!session || !session.user || session.user.role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
};
