"use server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const submissionSchema = z.object({
  input: z.string().min(1, "Input is required"),
});

export async function submitExtension(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const input = formData.get("input");
  const result = submissionSchema.safeParse({ input });

  if (!result.success) {
    return { error: "Invalid input" };
  }

  try {
    await prisma.submission.create({
      data: {
        userId: user.id,
        input: result.data.input,
        status: "PENDING",
      },
    });

    // TODO: Trigger analysis here (server-side)

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Submission error:", error);
    return { error: "Something went wrong" };
  }
}
