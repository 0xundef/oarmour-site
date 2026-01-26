import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ShieldCheck, Clock } from "lucide-react";
import { DiscordLogoIcon } from "@radix-ui/react-icons";
import { ExtensionWalletIcon, WebPortalIcon } from "@/components/custom-icons";

export default function LandingPage() {
  const features = [
    {
      icon: ExtensionWalletIcon,
      title: "Browser Extension Wallet",
      description: "Detect malicious code and malicious traffic in nearly real-time. Verify source code integrity.",
    },
    {
      icon: WebPortalIcon,
      title: "Web Page Wallet",
      description: "Continuous monitoring of wallet portals for unauthorized changes, malicious code injection, and malicious traffic.",
    },
    {
      icon: Zap,
      title: "Real-Time Detection",
      description: "Detect malicious injections immediately. Reduce the time gap between deployment and attack.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
            <span className="font-bold">OArmour</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link href="#features" className="hover:text-primary transition-colors">
              Product
            </Link>
            <span className="hover:text-primary transition-colors cursor-pointer">
              Solutions
            </span>
          </nav>
          <div className="flex items-center space-x-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="https://discord.gg/Dcu73t7mkP" target="_blank" rel="noopener noreferrer">
                <DiscordLogoIcon className="w-5 h-5" />
                <span className="sr-only">Join Discord</span>
              </Link>
            </Button>
            <Button asChild>
              <Link href="/signin">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-b from-muted/50 to-background py-20 px-4">
        <div className="container text-center max-w-5xl">

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Secure the Web3 Entrance
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-3xl mx-auto">
            We efficiently detect and block threats, such as web wallet compromise in real-time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/signin">
                Get Started - its free
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link href="#gap">
                Why It Matters
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The Security Gap Section */}
      <section id="gap" className="py-20 px-4 bg-background">
        <div className="container max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                The Security Gap
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                While blockchain is built on cryptography, users connect via bridges—Chrome extensions and web pages. 
                This &quot;last inch&quot; is where attacks happen.
              </p>
              <p className="text-lg text-muted-foreground mb-6">
                Recent incidents show a critical delay between malicious code injection and detection:
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-red-500 mt-1" />
                  <div>
                    <span className="font-semibold">7 Days Gap</span> - Bybit Hack (Feb 2025)
                    <p className="text-sm text-muted-foreground">Malicious code injected 7 days before attack triggered.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="w-6 h-6 text-red-500 mt-1" />
                  <div>
                    <span className="font-semibold">1 Day Gap</span> - Trust Wallet Hack (Dec 2025)
                    <p className="text-sm text-muted-foreground">Extension compromised 24 hours before detection.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-muted/30 p-8 rounded-xl border-2 border-dashed">
              <h3 className="text-xl font-semibold mb-4">What OArmour Detects</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span>Newly registered domains introduced in upgrades</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span>New hardcoded smart contract addresses</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span>Unexpected permission changes in extensions</span>
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  <span>Unauthorized script injections in web portals</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comprehensive Access Point Protection
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Dirty work done right. We monitor every upgrade and change so you don&apos;t have to.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-2 hover:border-primary transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section (Hidden) */}
      {/* <section id="pricing" className="py-20 px-4">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your security needs
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Free</CardTitle>
                <CardDescription>For security-conscious users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-6">$0<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Limited Extension Submission</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Unlimited Analysis Results</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">No Alert Subscription</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">No API Integration</span>
                  </li>
                </ul>
                <Button asChild className="w-full">
                  <Link href="/signin">
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary relative shadow-lg">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  POPULAR
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Starter</CardTitle>
                <CardDescription>For individual developers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-6">$10<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Limited Extension Submission</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Unlimited Analysis Results</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Max 2 Alert Subscriptions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">No API Integration</span>
                  </li>
                </ul>
                <Button asChild className="w-full">
                  <Link href="/signin">
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Pro</CardTitle>
                <CardDescription>For growing Web3 projects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-6">$30<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Unlimited Extension Submission</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Unlimited Analysis Results</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Max 10 Alert Subscriptions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">API Integration</span>
                  </li>
                </ul>
                <Button asChild className="w-full">
                  <Link href="/signin">
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section> */}

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center space-x-2">
              <Logo />
              <span className="font-bold">OArmour</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="https://discord.gg/Dcu73t7mkP" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                Discord
              </Link>
              <Link href="#" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 OArmour. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
