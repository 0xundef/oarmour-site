import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Realtime",
  description: "Realtime — sign in to manage your account.",
};

export default function LandingPageV2() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/v2" className="flex items-center space-x-2">
            <Logo />
            <span className="font-bold">Realtime</span>
          </Link>
          <div className="flex items-center space-x-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signin">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-muted/50 to-background px-4 py-20 md:py-24">
        <div className="container max-w-4xl text-center">
          {/* TODO: replace with the realtime product tagline once defined. */}
          <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">Realtime</h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            Sign in to your account to get started.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="px-8 text-lg">
              <Link href="/signin">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 py-8">
        <div className="container max-w-6xl flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center space-x-2">
            <Logo />
            <span className="font-bold">Realtime</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 Realtime. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
