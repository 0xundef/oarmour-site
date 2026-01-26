import Link from "next/link";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { ChevronLeft } from "lucide-react";

export default function BlogPage() {
  return (
    <div className="flex min-h-screen flex-col">
       <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
            <span className="font-bold">OArmour</span>
          </Link>
          <div className="flex items-center space-x-4">
            <Button asChild>
              <Link href="/signin">
                Get Started
              </Link>
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container py-12 max-w-4xl">
        <div className="mb-8">
            <Button asChild variant="ghost" size="sm">
                <Link href="/" className="flex items-center gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Home
                </Link>
            </Button>
        </div>
        
        <div className="text-center py-20 space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
            <p className="text-xl text-muted-foreground">
                Latest news, updates, and security insights from the OArmour team.
            </p>
            <div className="p-12 border rounded-lg bg-muted/20 mt-8">
                <p className="text-muted-foreground italic">No posts yet. Stay tuned!</p>
            </div>
        </div>
      </main>
    </div>
  );
}
