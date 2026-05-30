export type BlogTocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

/** Strip common inline Markdown for slug / display titles. */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function slugifyHeading(text: string): string {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniqueSlug(base: string, used: Set<string>): string {
  let slug = base || "section";
  if (!used.has(slug)) {
    used.add(slug);
    return slug;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  slug = `${base}-${n}`;
  used.add(slug);
  return slug;
}

/** Extract h2 / h3 headings from Markdown for table of contents. */
export function extractBlogToc(markdown: string): BlogTocItem[] {
  const items: BlogTocItem[] = [];
  const usedSlugs = new Set<string>();

  for (const line of markdown.split("\n")) {
    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      const title = stripInlineMarkdown(h3[1]);
      items.push({
        id: uniqueSlug(slugifyHeading(title), usedSlugs),
        title,
        level: 3,
      });
      continue;
    }

    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      const title = stripInlineMarkdown(h2[1]);
      items.push({
        id: uniqueSlug(slugifyHeading(title), usedSlugs),
        title,
        level: 2,
      });
    }
  }

  return items;
}
