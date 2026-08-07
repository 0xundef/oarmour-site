import Providers from "@/components/layout/providers";
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";
import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getServerSession } from "next-auth";
import { PHProvider } from "@/components/posthog-provider";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://realtime.app"),
  alternates: {
    canonical: "/",
  },
  title: {
    default: "Realtime",
    template: "%s | Realtime"
  },
  description: "Realtime — sign in to manage your account.",
  keywords: ["Realtime"],
  authors: [{ name: "Realtime" }],
  creator: "Realtime",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://realtime.app",
    title: "Realtime",
    description: "Realtime — sign in to manage your account.",
    siteName: "Realtime",
    images: [
      {
        url: "/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "Realtime"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Realtime",
    description: "Realtime — sign in to manage your account.",
    images: ["/icon-512x512.png"]
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
    "name": "Realtime",
    "url": "https://realtime.app",
    "logo": "https://realtime.app/logo.png",
    "description": "Realtime.",
    "sameAs": [],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "support@realtime.app"
    }
  };

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.className}`}>
        <PHProvider>
          <Providers session={session}>
            <ChunkLoadRecovery />
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
        <Script
          id="json-ld-website"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "url": "https://realtime.app",
              "name": "Realtime",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://realtime.app/?q={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      </body>
    </html>
  );
}
