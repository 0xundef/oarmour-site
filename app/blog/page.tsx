import Link from "next/link";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { ChevronLeft } from "lucide-react";
import { getAllPosts } from "@/lib/blog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | OArmour",
  description: "Latest news, updates, and security insights from the OArmour team.",
  alternates: { canonical: "https://oarmour.com/blog" },
  openGraph: {
    url: "https://oarmour.com/blog",
    title: "Blog | OArmour",
    description: "Latest news, updates, and security insights from the OArmour team.",
    images: [{ url: "/icon-512x512.png", width: 512, height: 512, alt: "OArmour Blog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | OArmour",
    description: "Latest news, updates, and security insights from the OArmour team.",
    images: ["/icon-512x512.png"],
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

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
        
        <div className="space-y-8">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
                <p className="text-xl text-muted-foreground">
                    Latest news, updates, and security insights from the OArmour team.
                </p>
            </div>

            {posts.length > 0 ? (
                <div className="grid gap-6">
                    {posts.map((post) => (
                        <Link key={post.slug} href={`/blog/${post.slug}`}>
                            <Card className="hover:bg-muted/50 transition-colors">
                                <CardHeader>
                                    <CardTitle>{post.title}</CardTitle>
                                    <CardDescription>
                                        {post.date} • {post.author}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{post.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <div className="p-12 border rounded-lg bg-muted/20 mt-8 text-center">
                    <p className="text-muted-foreground italic">No posts yet. Stay tuned!</p>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}
