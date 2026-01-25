import Providers from "@/components/layout/providers";
import { Toaster } from "@/components/ui/toaster";
import "@uploadthing/react/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { PHProvider } from "@/components/posthog-provider";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://oarmour.com"),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "OArmour - Web3 Access Point Security",
    template: "%s | OArmour"
  },
  description: "OArmour provides real-time monitoring for browser extension wallets and web portals. Detect malicious code injection, unauthorized changes, and secure your Web3 access points.",
  keywords: ["Web3 Security", "Browser Extension Wallet", "Malicious Code Detection", "Blockchain Security", "OArmour", "Real-time Monitoring"],
  authors: [{ name: "OArmour Team" }],
  creator: "OArmour",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://oarmour.com",
    title: "OArmour - Web3 Access Point Security",
    description: "Real-time detection of malicious code in browser extensions and web portals.",
    siteName: "OArmour",
  },
  twitter: {
    card: "summary_large_image",
    title: "OArmour - Web3 Access Point Security",
    description: "Protect your users from malicious extension upgrades and web portal injections.",
  },
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
  
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "OArmour",
    "url": "https://oarmour.com",
    "logo": "https://oarmour.com/logo.png",
    "description": "OArmour monitors Chrome extension upgrades and web portal changes to detect malicious code injection.",
    "sameAs": [
      "https://twitter.com/oarmour",
      "https://github.com/oarmour"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "support@oarmour.com"
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className}`}>
        <PHProvider>
          <Providers session={session}>
            <Toaster />
            {children}
          </Providers>
        </PHProvider>
        <Script
          id="json-ld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
