import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
            <span className="font-bold">Realtime</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Button asChild>
              <Link href="/signin">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-b from-muted/50 to-background py-20 px-4">
        <div className="container text-center max-w-3xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Realtime
          </h1>
          {/* TODO: replace with the realtime product tagline once defined. */}
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Sign in to your account to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/signin">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
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
