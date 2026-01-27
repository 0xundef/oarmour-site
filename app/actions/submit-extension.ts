"use server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { processExtension } from "@/lib/analysis-service";

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
    const submission = await prisma.submission.create({
      data: {
        userId: user.id,
        input: result.data.input,
        status: "APPROVED", // Auto-approve since we trigger analysis
      },
    });

    // Attempt to extract extension ID
    let extensionId = result.data.input;
    // Simple regex for Chrome Extension ID (32 alphabetic characters)
    const idMatch = extensionId.match(/([a-z]{32})/);
    
    if (idMatch) {
        extensionId = idMatch[1];
        // Trigger analysis in background
        processExtension(extensionId).catch(err => {
            console.error(`Background analysis failed for submission ${submission.id}:`, err);
        });
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Submission error:", error);
    return { error: "Something went wrong" };
  }
}
