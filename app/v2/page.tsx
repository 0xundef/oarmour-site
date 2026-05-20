import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  Building2,
  ChevronDown,
  Clock,
  Globe,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { DiscordLogoIcon } from "@radix-ui/react-icons";
import { Icons } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const metadata: Metadata = {
  title: "OArmour V2 - Web3 Extension Security for Teams",
  description:
    "Monitor Chrome wallet extensions across every release. Static analysis, AI browser testing, and domain intelligence for Web3 teams.",
};

const monitoredWallets = [
  "MetaMask",
  "Trust Wallet",
  "Coinbase Wallet",
  "Rabby",
  "Phantom",
  "OKX Wallet",
];

const audiences = [
  {
    icon: Building2,
    title: "Wallet & Web3 Teams",
    badge: "Primary",
    description:
      "Monitor your official Chrome extension across every release. Catch supply-chain tampering, new outbound domains, and permission drift before users are affected.",
    points: ["Continuous version monitoring", "Release diff & domain enrichment", "Team-ready alert workflow"],
  },
  {
    icon: ShieldCheck,
    title: "Security & Compliance",
    description:
      "Reduce manual extension review. Combine static analysis, runtime network capture, and domain intelligence in one workflow.",
    points: ["Static + AI browser testing", "WHOIS / RDAP domain signals", "Audit-friendly history"],
  },
  {
    icon: User,
    title: "Individual Users",
    badge: "Also supported",
    description:
      "Subscribe to wallets you rely on and get notified when an upgrade introduces suspicious changes—no security team required.",
    points: ["Free to start", "Subscribe to known wallets", "Email alerts on changes"],
  },
];

const steps = [
  {
    step: "01",
    title: "Register your extension",
    description: "Add your Chrome Web Store ID or submit any extension for baseline analysis.",
  },
  {
    step: "02",
    title: "We monitor every upgrade",
    description: "Static scans run on each version. Optional AI browser testing captures runtime network traffic.",
  },
  {
    step: "03",
    title: "Get alerted on risk",
    description: "New domains, permission changes, and malicious indicators surface in your dashboard and subscriptions.",
  },
];

const features = [
  {
    icon: Icons.webExtension,
    title: "Extension Version Monitoring",
    description: "Track Chrome extension releases automatically and diff domains, permissions, and code surfaces between versions.",
  },
  {
    icon: ScanSearch,
    title: "Static Code Analysis",
    description: "Extract domains, IPs, and URLs from packaged extension code on every scan—no manual unpacking required.",
  },
  {
    icon: Sparkles,
    title: "AI Browser Testing",
    description: "Run controlled browser sessions to capture runtime network requests and flag domains that static analysis alone would miss.",
  },
  {
    icon: Globe,
    title: "Domain Intelligence",
    description: "Enrich apex domains with registration age, registrar data, and threat signals to prioritize investigation.",
  },
];

function ProductPreview() {
  const rows = [
    { name: "Trust Wallet", version: "2.49.0 → 2.50.1", risk: "HIGH", domains: "+3 domains" },
    { name: "MetaMask", version: "12.5.0 → 12.5.1", risk: "SAFE", domains: "No change" },
    { name: "Rabby Wallet", version: "0.93.28", risk: "CAUTION", domains: "+1 domain" },
  ];

  return (
    <div className="mx-auto mt-14 max-w-4xl rounded-xl border bg-card p-4 shadow-lg md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-sm font-medium">Threat Alerts</p>
          <p className="text-xs text-muted-foreground">Monitored extensions · near real-time</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Live
        </Badge>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.name}
            className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.version}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{row.domains}</span>
              <Badge
                variant="outline"
                className={
                  row.risk === "HIGH"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : row.risk === "CAUTION"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-green-200 bg-green-50 text-green-700"
                }
              >
                {row.risk}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPageV2() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/v2" className="flex items-center space-x-2">
            <Logo />
            <span className="font-bold">OArmour</span>
            <Badge variant="secondary" className="text-[10px] font-normal uppercase tracking-wide">
              V2
            </Badge>
          </Link>
          <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
            <Link href="#features" className="transition-colors hover:text-primary">
              Product
            </Link>
            <Link href="#audiences" className="transition-colors hover:text-primary">
              Solutions
            </Link>
            <Link href="#how-it-works" className="transition-colors hover:text-primary">
              How It Works
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-1 outline-none transition-colors hover:text-primary"
                suppressHydrationWarning
              >
                Resources <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[--radix-dropdown-menu-trigger-width] min-w-0">
                <DropdownMenuItem asChild>
                  <Link href="/blog" className="w-full cursor-pointer">
                    Blog
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="flex items-center space-x-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="https://discord.gg/Dcu73t7mkP" target="_blank" rel="noopener noreferrer">
                <DiscordLogoIcon className="h-5 w-5" />
                <span className="sr-only">Join Discord</span>
              </Link>
            </Button>
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
        <div className="container max-w-6xl">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="secondary" className="mb-6">
              Built for wallet teams · open to individual users
            </Badge>
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              Monitor wallet extensions before upgrades become incidents
            </h1>
            <p className="mx-auto mb-8 max-w-3xl text-lg text-muted-foreground">
              OArmour helps Web3 teams continuously watch Chrome extension releases—static analysis,
              runtime network capture, and domain intelligence—so supply-chain attacks surface in hours,
              not days.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" className="px-8 text-lg">
                <Link href="/signin">Monitor your extension — free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="px-8 text-lg">
                <Link href="#how-it-works">See how it works</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Individual users can subscribe to wallets like MetaMask or Trust Wallet and receive change alerts.
            </p>
          </div>

          <ProductPreview />

          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">Teams monitor wallets such as</span>
            {monitoredWallets.map((name) => (
              <Badge key={name} variant="outline" className="font-normal">
                {name}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Audiences */}
      <section id="audiences" className="bg-background px-4 py-20">
        <div className="container max-w-6xl">
          <div className="mb-12 max-w-2xl">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Who OArmour is for</h2>
            <p className="text-lg text-muted-foreground">
              Primary focus on teams responsible for wallet distribution and user safety. Individual
              subscribers are supported on the same platform.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {audiences.map((item) => (
              <Card key={item.title} className="border-2">
                <CardHeader>
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    {item.badge ? (
                      <Badge variant={item.badge === "Primary" ? "default" : "secondary"}>{item.badge}</Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CardDescription className="text-base">{item.description}</CardDescription>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-muted/30 px-4 py-20">
        <div className="container max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">How it works</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              From first submission to ongoing monitoring in three steps.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((item) => (
              <Card key={item.step} className="border-2 bg-background">
                <CardHeader>
                  <p className="text-sm font-semibold text-primary">{item.step}</p>
                  <CardTitle className="text-xl">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security gap */}
      <section id="gap" className="bg-background px-4 py-20">
        <div className="container max-w-6xl">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold md:text-4xl">The security gap</h2>
              <p className="mb-6 text-lg text-muted-foreground">
                Blockchain security is strong on-chain, but users connect through Chrome extensions and web
                portals. This &quot;last inch&quot; is where recent wallet supply-chain attacks started.
              </p>
              <p className="mb-6 text-lg text-muted-foreground">
                Industry incidents show a dangerous delay between malicious injection and public detection:
              </p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <Clock className="mt-1 h-6 w-6 text-red-500" />
                  <div>
                    <span className="font-semibold">7-day gap</span> — Bybit hack (Feb 2025)
                    <p className="text-sm text-muted-foreground">
                      Malicious code lived in the frontend for a week before the breach.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-1 h-6 w-6 text-red-500" />
                  <div>
                    <span className="font-semibold">1-day gap</span> — Trust Wallet incident (Dec 2025)
                    <p className="text-sm text-muted-foreground">
                      Extension compromise detected roughly 24 hours after injection.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-8">
              <h3 className="mb-4 text-xl font-semibold">What OArmour flags</h3>
              <ul className="space-y-3">
                {[
                  "Newly registered domains introduced in upgrades",
                  "New hardcoded smart contract addresses",
                  "Unexpected permission changes in extensions",
                  "Runtime network requests to unknown endpoints",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/30 px-4 py-20">
        <div className="container max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Platform capabilities</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Everything your security team needs to watch the extension surface area—without building it in-house.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 transition-colors hover:border-primary">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <div className="container max-w-4xl">
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
            <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center md:px-12">
              <div className="flex items-center gap-2 text-primary">
                <Bell className="h-5 w-5" />
                <Zap className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-bold">Start monitoring today</h2>
              <p className="max-w-2xl text-lg text-muted-foreground">
                Wallet teams can onboard an extension in minutes. Individual users can subscribe to existing
                wallets and receive alerts—free to get started.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/signin">Create free account</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="https://discord.gg/Dcu73t7mkP" target="_blank" rel="noopener noreferrer">
                    Talk to us on Discord
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t px-4 py-8">
        <div className="container max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center space-x-2">
              <Logo />
              <span className="font-bold">OArmour</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <Link href="/terms" className="transition-colors hover:text-foreground">
                Terms of Service
              </Link>
              <Link href="/privacy" className="transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
              <Link
                href="https://discord.gg/Dcu73t7mkP"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                Discord
              </Link>
              <Link href="mailto:support@oarmour.com" className="transition-colors hover:text-foreground">
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 OArmour. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
