import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubmissionsTable } from "@/components/admin/submissions-table";
import { UsersTable } from "@/components/admin/users-table";
import { ExtensionsTable } from "@/components/admin/extensions-table";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

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

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
        submissions: {
            select: {
                id: true,
                status: true
            }
        }
    }
  });
  
  // Extensions list for monitoring control (tolerant to missing column)
  let extensions: Array<{ id: string; name: string; storeId: string; version: string | null; isMonitored?: boolean; checkFrequencyMinutes?: number }> = []
  try {
    extensions = await (prisma as any).globalExtension.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, storeId: true, version: true, isMonitored: true, checkFrequencyMinutes: true },
    })
  } catch {
    extensions = await prisma.globalExtension.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, storeId: true, version: true },
    })
  }

  return (
    <div className="container mx-auto py-10">
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="extensions">Extensions</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="space-y-4">
          <UsersTable users={users} />
        </TabsContent>
        <TabsContent value="submissions" className="space-y-4">
          <SubmissionsTable submissions={submissions} />
        </TabsContent>
        <TabsContent value="extensions" className="space-y-4">
          <ExtensionsTable extensions={extensions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
