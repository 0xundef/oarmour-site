import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { ChevronLeft } from "lucide-react";
import { getPostBySlug, getAllPosts } from "@/lib/blog";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

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
      
      <main className="flex-1 container py-12 max-w-3xl">
        <div className="mb-8">
            <Button asChild variant="ghost" size="sm">
                <Link href="/blog" className="flex items-center gap-2">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Blog
                </Link>
            </Button>
        </div>
        
        <article className="prose prose-neutral dark:prose-invert max-w-none">
            <div className="mb-8 not-prose border-b pb-8">
                <h1 className="text-4xl font-bold tracking-tight mb-4">{post.title}</h1>
                <div className="text-muted-foreground flex items-center gap-2">
                    <span>{post.date}</span>
                    <span>•</span>
                    <span>{post.author}</span>
                </div>
            </div>
            
            <MDXRemote source={post.content} />
        </article>
      </main>
    </div>
  );
}
