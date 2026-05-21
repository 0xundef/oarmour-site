import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"

export async function getIssueChatSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  return typeof userId === "string" && userId.length > 0 ? userId : null
}
