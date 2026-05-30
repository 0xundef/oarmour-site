import Link from "next/link";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { ChevronLeft } from "lucide-react";
import { getAllPosts, type Post } from "@/lib/blog";
import { BLOG_CATEGORIES, type BlogCategoryId } from "@/lib/blog-categories";
import { Badge } from "@/components/ui/badge";
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

const CATEGORY_ORDER: BlogCategoryId[] = ["code", "general"];

function PostCard({ post }: { post: Post }) {
  const category = BLOG_CATEGORIES[post.category];

  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge variant="secondary">{category.label}</Badge>
            {post.featured ? <Badge variant="outline">Featured</Badge> : null}
          </div>
          <CardTitle>{post.title}</CardTitle>
          <CardDescription>
            {post.date}
            {post.readingTime ? ` • ${post.readingTime} min read` : ""}
            {` • ${post.author}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{post.description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function BlogPage() {
  const posts = getAllPosts();

  const sections = CATEGORY_ORDER.map((categoryId) => ({
    ...BLOG_CATEGORIES[categoryId],
    posts: posts.filter((post) => post.category === categoryId),
  })).filter((section) => section.posts.length > 0);

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
        
        <div className="space-y-12">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
                <p className="text-xl text-muted-foreground">
                    Latest news, updates, and security insights from the OArmour team.
                </p>
            </div>

            {sections.length > 0 ? (
                sections.map((section) => (
                  <section key={section.id} className="space-y-4">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold tracking-tight">{section.label}</h2>
                      <p className="text-muted-foreground">{section.description}</p>
                    </div>
                    <div className="grid gap-6">
                      {section.posts.map((post) => (
                        <PostCard key={post.slug} post={post} />
                      ))}
                    </div>
                  </section>
                ))
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
