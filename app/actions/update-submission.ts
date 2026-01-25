"use server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const updateSubmissionSchema = z.object({
  id: z.string(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export async function updateSubmissionStatus(id: string, status: "PENDING" | "APPROVED" | "REJECTED") {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  const result = updateSubmissionSchema.safeParse({ id, status });

  if (!result.success) {
    return { error: "Invalid input" };
  }

  try {
    await prisma.submission.update({
      where: { id },
      data: { status },
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Update submission error:", error);
    return { error: "Something went wrong" };
  }
}
