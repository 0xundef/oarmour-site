import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Search, Zap, AlertTriangle, BarChart3, Users } from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: Shield,
      title: "AML Compliance",
      description: "Advanced Anti-Money Laundering detection with real-time monitoring and compliance reporting.",
    },
    {
      icon: Search,
      title: "Blockchain Auditing",
      description: "Comprehensive auditing tools to track and analyze blockchain transactions across multiple networks.",
    },
    {
      icon: Zap,
      title: "Real-Time Detection",
      description: "Instant alerts for suspicious activities with automated risk scoring and threat analysis.",
    },
    {
      icon: AlertTriangle,
      title: "Risk Assessment",
      description: "Sophisticated risk models to identify and categorize potential threats before they become problems.",
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Powerful analytics and visualization tools to understand your data and make informed decisions.",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Seamless team management with role-based access control and activity tracking.",
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
              Features
            </Link>
            <Link href="#pricing" className="hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="#about" className="hover:text-primary transition-colors">
              About
            </Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Link href="/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/signin">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center bg-gradient-to-b from-muted/50 to-background py-20 px-4">
        <div className="container text-center max-w-4xl">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            The Armour of Blockchain
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Focus on AML • Auditing • Real-time detection
          </p>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            Protect your organization with advanced blockchain compliance tools. Monitor transactions,
            detect risks, and stay compliant with comprehensive auditing and real-time threat detection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signin">
              <Button size="lg" className="text-lg px-8">
                Get Started Free
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful Features for Blockchain Security
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to ensure AML compliance and secure your blockchain operations
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your organization&apos;s needs
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Starter</CardTitle>
                <CardDescription>For small teams getting started</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-6">$99<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Up to 5 team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Basic AML monitoring</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Standard reports</span>
                  </li>
                </ul>
                <Link href="/signin" className="w-full">
                  <Button variant="outline" className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Popular
                </span>
              </div>
              <CardHeader>
                <CardTitle className="text-2xl">Professional</CardTitle>
                <CardDescription>For growing organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-6">$299<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Up to 20 team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Advanced AML detection</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Real-time alerts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Custom reports</span>
                  </li>
                </ul>
                <Link href="/signin" className="w-full">
                  <Button className="w-full">Get Started</Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-2xl">Enterprise</CardTitle>
                <CardDescription>For large-scale operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-6">Custom</div>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Unlimited team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Full AML suite</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">API access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">Dedicated support</span>
                  </li>
                </ul>
                <Link href="/signin" className="w-full">
                  <Button variant="outline" className="w-full">Contact Sales</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 bg-muted/30">
        <div className="container max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Why Choose OArmour?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            OArmour is built by blockchain security experts who understand the challenges of maintaining compliance
            in an ever-evolving regulatory landscape. Our platform combines cutting-edge technology with industry best
            practices to provide you with the most comprehensive blockchain security and AML compliance solution.
          </p>
          <div className="grid md:grid-cols-3 gap-8 text-left">
            <div>
              <h3 className="font-semibold text-xl mb-2">Industry Leading</h3>
              <p className="text-muted-foreground">
                Trusted by organizations worldwide to protect millions in transactions
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-xl mb-2">Compliance Ready</h3>
              <p className="text-muted-foreground">
                Meet regulatory requirements with built-in compliance frameworks
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-xl mb-2">24/7 Monitoring</h3>
              <p className="text-muted-foreground">
                Round-the-clock surveillance and instant threat detection
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Secure Your Blockchain Operations?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join thousands of organizations using OArmour to stay compliant and secure
          </p>
          <Link href="/signin">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Your Free Trial
            </Button>
          </Link>
        </div>
      </section>

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
              <Link href="#" className="hover:text-foreground transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 OArmour. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
