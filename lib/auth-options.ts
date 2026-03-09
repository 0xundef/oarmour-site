import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import CredentialProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

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
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
    CredentialProvider({
      credentials: {
        email: {
          label: "email",
          type: "email",
          placeholder: "example@gmail.com",
        },
      },
      async authorize(credentials, req) {
        const user = { id: "1", name: "John", email: credentials?.email, role: "USER" as const };
        if (user) {
          // Any object returned will be saved in `user` property of the JWT
          return user;
        } else {
          // If you return null then an error will be displayed advising the user to check their details.
          return null;

          // You can also Reject this callback with an Error thus the user will be sent to the error page with the error message as a query parameter
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // console.log(`User: ${JSON.stringify(user)}, Account: ${JSON.stringify(account)}, Profile: ${JSON.stringify(profile)}`);
      return true;
    },
    async redirect({ url, baseUrl }) {
      return baseUrl + '/dashboard';
    },
    async session({ session, token }) {
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
