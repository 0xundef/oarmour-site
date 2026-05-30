"use client";

import { useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { BlogTocItem } from "@/lib/blog-toc";

type BlogMarkdownProps = {
  content: string;
  headings: BlogTocItem[];
};

function isExternalHref(href: string | undefined): boolean {
  if (!href) return false;
  return href.startsWith("http://") || href.startsWith("https://");
}

export function BlogMarkdown({ content, headings }: BlogMarkdownProps) {
  const headingIndex = useRef(0);
  headingIndex.current = 0;

  const nextHeadingId = (level: 2 | 3): string | undefined => {
    const entry = headings[headingIndex.current];
    if (!entry || entry.level !== level) return undefined;
    headingIndex.current += 1;
    return entry.id;
  };

  const components: Components = {
    h2: ({ children, ...props }) => {
      const id = nextHeadingId(2);
      return (
        <h2 id={id} className="scroll-mt-24" {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }) => {
      const id = nextHeadingId(3);
      return (
        <h3 id={id} className="scroll-mt-24" {...props}>
          {children}
        </h3>
      );
    },
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        target={isExternalHref(href) ? "_blank" : undefined}
        rel={isExternalHref(href) ? "noopener noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    ),
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
