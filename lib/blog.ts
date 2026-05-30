import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { type BlogCategoryId, normalizeBlogCategory } from "@/lib/blog-categories";

const postsDirectory = path.join(process.cwd(), "content/blog");

export type Post = {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
  content: string;
  category: BlogCategoryId;
  tags?: string[];
  readingTime?: number;
  updated?: string;
  featured?: boolean;
};

export function getAllPosts(): Post[] {
  // Ensure directory exists
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory);
  const allPostsData = fileNames.map((fileName) => {
    // Remove ".mdx" from file name to get slug
    const slug = fileName.replace(/\.mdx$/, "");

    // Read markdown file as string
    const fullPath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");

    // Use gray-matter to parse the post metadata section
    const { data, content } = matter(fileContents);

    return {
      slug,
      content,
      title: data.title,
      date: data.date,
      description: data.description,
      author: data.author,
      category: normalizeBlogCategory(data.category),
      tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : undefined,
      readingTime: typeof data.readingTime === "number" ? data.readingTime : undefined,
      updated: typeof data.updated === "string" ? data.updated : undefined,
      featured: data.featured === true,
    };
  });

  // Sort posts by date
  return allPostsData.sort((a, b) => {
    if (a.date < b.date) {
      return 1;
    } else {
      return -1;
    }
  });
}

export function getPostBySlug(slug: string): Post | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.mdx`);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      slug,
      content,
      title: data.title,
      date: data.date,
      description: data.description,
      author: data.author,
      category: normalizeBlogCategory(data.category),
      tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : undefined,
      readingTime: typeof data.readingTime === "number" ? data.readingTime : undefined,
      updated: typeof data.updated === "string" ? data.updated : undefined,
      featured: data.featured === true,
    };
  } catch {
    return null;
  }
}
