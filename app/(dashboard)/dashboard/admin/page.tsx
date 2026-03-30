import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { UsersTable } from "@/components/admin/users-table";
import { ExtensionsTable } from "@/components/admin/extensions-table";
import { MonitorJobsDashboard } from "@/components/admin/monitor-jobs-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AdminSection = "users" | "extensions" | "monitoring";

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
  const section = (
    rawSection === "submissions" || rawSection === "monitor"
      ? rawSection === "monitor" ? "monitoring" : "extensions"
      : ["users", "extensions", "monitoring"].includes(rawSection)
        ? rawSection
        : "users"
  ) as AdminSection;

  let title = "";
  let description = "";
  let content: JSX.Element = <div />;

  if (section === "users") {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        submissions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
    title = "Users";
    description = "Review registered users, roles, and submission activity.";
    content = <UsersTable users={users} />;
  }

  if (section === "extensions") {
    const submissions = await prisma.submission.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });
    title = "Extension Management";
    description = "Manage extension-related workflow and review submission history.";
    content = (
      <Tabs key="extension-management-tabs" defaultValue="submission-history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="submission-history">Submission History</TabsTrigger>
        </TabsList>
        <TabsContent value="submission-history" className="space-y-4">
          <SubmissionsTable submissions={submissions} />
        </TabsContent>
      </Tabs>
    );
  }

  if (section === "monitoring") {
    let rawExtensions: Array<{ id: string; name: string; storeId: string; version: string | null; isMonitored: boolean; testingMode: boolean; checkFrequencyMinutes: number | null }> = []
    try {
      rawExtensions = await prisma.$queryRaw`
        SELECT "id","name","storeId","version","isMonitored","testingMode","checkFrequencyMinutes"
        FROM "GlobalExtension"
        ORDER BY "updatedAt" DESC
      `;
    } catch {
      const legacyExtensions = await prisma.$queryRaw<Array<{ id: string; name: string; storeId: string; version: string | null; isMonitored: boolean; checkFrequencyMinutes: number | null }>>`
        SELECT "id","name","storeId","version","isMonitored","checkFrequencyMinutes"
        FROM "GlobalExtension"
        ORDER BY "updatedAt" DESC
      `;
      rawExtensions = legacyExtensions.map((e) => ({
        ...e,
        testingMode: false,
      }))
    }
    const extensions = rawExtensions.map((e) => ({
      id: e.id,
      name: e.name,
      storeId: e.storeId,
      version: e.version,
      isMonitored: e.isMonitored,
      testingMode: e.testingMode,
      checkFrequencyMinutes: e.checkFrequencyMinutes ?? undefined,
    }));
    title = "Monitoring";
    description = "Manage extension monitoring and monitor service health in one place.";
    const defaultTab = "service-health";
    content = (
      <Tabs key="monitoring-tabs" defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="extensions">Extension Management</TabsTrigger>
          <TabsTrigger value="service-health">Service Health</TabsTrigger>
        </TabsList>
        <TabsContent value="extensions" className="space-y-4">
          <ExtensionsTable extensions={extensions} />
        </TabsContent>
        <TabsContent value="service-health" className="space-y-4">
          <MonitorJobsDashboard />
        </TabsContent>
      </Tabs>
    );
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
