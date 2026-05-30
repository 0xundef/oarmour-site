export type BlogCategoryId = "code" | "general";

export type BlogCategory = {
  id: BlogCategoryId;
  label: string;
  description: string;
};

export const BLOG_CATEGORIES: Record<BlogCategoryId, BlogCategory> = {
  code: {
    id: "code",
    label: "Security Analysis",
    description: "Deep dives on incidents, supply-chain attacks, and wallet security research.",
  },
  general: {
    id: "general",
    label: "Updates & Guides",
    description: "Product news, tutorials, and general Web3 security guidance.",
  },
};

export function normalizeBlogCategory(raw: unknown): BlogCategoryId {
  if (raw === "code") return "code";
  return "general";
}

export function getBlogCategory(id: BlogCategoryId): BlogCategory {
  return BLOG_CATEGORIES[id];
}
