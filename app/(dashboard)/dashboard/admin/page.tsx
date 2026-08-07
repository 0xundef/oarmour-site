import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { LoginActivitiesTable } from "@/components/admin/login-activities-table";
import { UsersTable } from "@/components/admin/users-table";

type AdminSection = "users" | "audit";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { section?: string } | Promise<{ section?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const rawSection = resolvedSearchParams.section || "";
  const section: AdminSection = rawSection === "audit" ? "audit" : "users";

  let title = "";
  let description = "";
  let content: JSX.Element = <div />;

  if (section === "users") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    title = "Users";
    description = "Review registered users, roles, and access.";
    content = <UsersTable users={users} currentAdminId={user.id} />;
  }

  if (section === "audit") {
    const loginActivities = await prisma.loginActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
    title = "Audit";
    description = "Review user login activity.";
    content = <LoginActivitiesTable activities={loginActivities} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{content}</div>
    </div>
  );
}
