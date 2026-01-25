"use server"

import { prisma } from "@/lib/prisma"

export async function searchExtension(query: string) {
  if (!query) return null

  // Search in Submission table by input (extension ID or URL)
  const submission = await prisma.submission.findFirst({
    where: {
      input: { contains: query }
    },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    }
  })

  return submission
}
