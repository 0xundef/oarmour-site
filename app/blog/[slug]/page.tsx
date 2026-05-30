import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Logo from "@/components/logo";
import { ChevronLeft } from "lucide-react";
import { getPostBySlug, getAllPosts } from "@/lib/blog";
import { extractBlogToc } from "@/lib/blog-toc";
import { BLOG_CATEGORIES } from "@/lib/blog-categories";
import { Badge } from "@/components/ui/badge";
import { BlogMarkdown } from "@/components/blog/blog-markdown";
import { BlogTableOfContents } from "@/components/blog/blog-table-of-contents";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) {
    return {};
  }
  const url = `https://oarmour.com/blog/${post.slug}`;
  const title = `${post.title} | OArmour`;
  const description = post.description || post.title;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "OArmour",
      images: [{ url: "/icon-512x512.png", width: 512, height: 512, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/icon-512x512.png"],
    },
  };
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const toc = extractBlogToc(post.content);

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
      
      <main className="container max-w-6xl flex-1 py-12">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/blog" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-10 xl:flex-row xl:gap-12">
          {toc.length > 0 ? (
            <aside className="not-prose hidden shrink-0 xl:block xl:w-56">
              <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
                <BlogTableOfContents items={toc} />
              </div>
            </aside>
          ) : null}

          <article className="prose prose-neutral dark:prose-invert min-w-0 max-w-3xl flex-1">
            <div className="not-prose mb-8 border-b pb-8">
              {post.category === "code" ? (
                <Badge variant="secondary" className="mb-4">
                  {BLOG_CATEGORIES.code.label}
                </Badge>
              ) : null}
              <h1 className="mb-4 text-4xl font-bold tracking-tight">{post.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <span>{post.date}</span>
                <span>•</span>
                <span>{post.author}</span>
              </div>
            </div>

            {toc.length > 0 ? (
              <div className="not-prose mb-8 border-b pb-8 xl:hidden">
                <BlogTableOfContents items={toc} />
              </div>
            ) : null}

            <BlogMarkdown content={post.content} headings={toc} />
          </article>
        </div>
      </main>
    </div>
  );
}
