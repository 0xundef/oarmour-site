import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/request-ip";
import { recordLoginActivity, resolveUserIdForLoginLog } from "@/lib/record-login-activity";
import { isUserDisabled, isUserDisabledByEmail } from "@/lib/user-account-status";
import bcrypt from "bcryptjs";
import { logError } from "@/lib/app-logger";

const enableAdapter =
  process.env.NEXTAUTH_USE_ADAPTER === "1" ||
  (process.env.NODE_ENV === "production" && !!process.env.db1_POSTGRES_PRISMA_URL);

export const authOptions: NextAuthOptions = {
  ...(enableAdapter ? { adapter: PrismaAdapter(prisma) } : {}),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    GithubProvider({
      clientId: process.env.OAUTH_GITHUB_ID ?? process.env.GITHUB_ID ?? "",
      clientSecret: process.env.OAUTH_GITHUB_SECRET ?? process.env.GITHUB_SECRET ?? "",
    }),
    CredentialProvider({
      credentials: {
        email: {
          label: "email",
          type: "email",
          placeholder: "example@gmail.com",
        },
        password: {
          label: "password",
          type: "password",
        },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        if (await isUserDisabledByEmail(email)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            disabled: true,
          },
        });
        if (!user?.password || user.disabled) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      try {
        const userId = await resolveUserIdForLoginLog(user);
        if (userId && (await isUserDisabled(userId))) {
          return "/signin?error=AccountDisabled";
        }
        if (userId) {
          const h = await headers();
          const ipAddress = clientIpFromHeaders(h);
          const provider = account?.provider ?? (account ? null : "credentials");
          await recordLoginActivity({ userId, ipAddress, provider });
        }
      } catch (e) {
        logError('[auth] failed to record login activity', { error: e });
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      return baseUrl + '/dashboard';
    },
    async session({ session, token }) {
      if ((token as { blocked?: boolean }).blocked) {
        return { ...session, expires: new Date(0).toISOString() };
      }
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as any) ?? "USER";
      }
      return session;
    },
    async jwt({ token, user, account, profile, isNewUser }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? token.role ?? "USER";
        (token as any).email = (user as any).email ?? (token as any).email;
      }
      if (typeof token.id === "string") {
        const row = await prisma.user.findUnique({
          where: { id: token.id },
          select: { disabled: true, role: true },
        });
        if (!row || row.disabled) {
          (token as { blocked?: boolean }).blocked = true;
          return token;
        }
        (token as { blocked?: boolean }).blocked = false;
        token.role = row.role as typeof token.role;
      }
      const rawList = process.env.NEXTAUTH_DEV_ADMIN_EMAILS ?? "";
      const devListRaw =
        process.env.NODE_ENV !== "production"
          ? rawList || "*"
          : rawList;
      const devList = devListRaw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const emailLower = typeof (token as any).email === "string" ? ((token as any).email as string).toLowerCase() : "";
      if (devList.length > 0 && (devList.includes("*") || devList.includes(emailLower))) {
        token.role = "ADMIN" as any;
      }
      token.role = token.role ?? ("USER" as any);
      return token;
    },
  },
  pages: {
    signIn: "/signin",
  },
};
