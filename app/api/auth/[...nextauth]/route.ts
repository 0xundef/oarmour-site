import { authOptions } from "@/lib/auth-options";
import NextAuth from "next-auth/next";

export const runtime = "nodejs";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
