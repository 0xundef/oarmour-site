import Providers from "@/components/layout/providers";
import { Toaster } from "@/components/ui/toaster";
import "@uploadthing/react/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { PHProvider } from "@/components/posthog-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OArmour - The Armour of Blockchain",
  description: "Foucus on AML|Auditing|Real-time detection",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico', 
  }
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} overflow-hidden`}>
        <PHProvider>
          <Providers session={session}>
            <Toaster />
            {children}
          </Providers>
        </PHProvider>
      </body>
    </html>
  );
}
