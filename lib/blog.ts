import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { type BlogCategoryId, normalizeBlogCategory } from "@/lib/blog-categories";
import { stripInlineMarkdown } from "@/lib/blog-toc";

const postsDirectory = path.join(process.cwd(), "content/blog");

export type Post = {
  slug: string;
  title: string;
  date: string;
  description: string;
  author: string;
  content: string;
  category: BlogCategoryId;
};

function isPostFile(fileName: string): boolean {
  return (
    !fileName.startsWith("_") &&
    (fileName.endsWith(".md") || fileName.endsWith(".mdx"))
  );
}

function resolvePostFileName(slug: string): string | null {
  const mdPath = path.join(postsDirectory, `${slug}.md`);
  if (fs.existsSync(mdPath)) return `${slug}.md`;

  const mdxPath = path.join(postsDirectory, `${slug}.mdx`);
  if (fs.existsSync(mdxPath)) return `${slug}.mdx`;

  return null;
}

function normalizeTitle(text: string): string {
  return stripInlineMarkdown(text).replace(/\s+/g, " ").trim();
}

/** Drop a leading `#` heading when it repeats frontmatter title (page header already renders it). */
function stripDuplicateLeadingTitle(content: string, title: string): string {
  const expected = normalizeTitle(title);
  if (!expected) return content;

  const lines = content.split("\n");
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") index++;

  const match = /^#\s+(.+)$/.exec(lines[index]?.trim() ?? "");
  if (!match || normalizeTitle(match[1]) !== expected) return content;

  lines.splice(index, 1);
  if (lines[index]?.trim() === "") lines.splice(index, 1);
  return lines.join("\n");
}

function parsePostFile(fileName: string): Post {
  const slug = fileName.replace(/\.mdx?$/, "");
  const fullPath = path.join(postsDirectory, fileName);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    slug,
    content: stripDuplicateLeadingTitle(content, data.title),
    title: data.title,
    date: data.date,
    description: data.description,
    author: data.author,
    category: normalizeBlogCategory(data.category),
  };
}

export function getAllPosts(): Post[] {
  if (!fs.existsSync(postsDirectory)) {
    return [];
  }

  const fileNames = fs.readdirSync(postsDirectory).filter(isPostFile);
  const preferredFiles = new Map<string, string>();

  for (const fileName of fileNames) {
    const slug = fileName.replace(/\.mdx?$/, "");
    const existing = preferredFiles.get(slug);
    if (!existing || (fileName.endsWith(".md") && existing.endsWith(".mdx"))) {
      preferredFiles.set(slug, fileName);
    }
  }

  return Array.from(preferredFiles.values())
    .map(parsePostFile)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): Post | null {
  try {
    const fileName = resolvePostFileName(slug);
    if (!fileName) return null;
    return parsePostFile(fileName);
  } catch {
    return null;
  }
}
