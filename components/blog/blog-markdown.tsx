"use client";

import { isValidElement, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { BlogTocItem } from "@/lib/blog-toc";
import { BlogMermaid } from "@/components/blog/blog-mermaid";

function getCodeBlockLanguage(className: unknown): string | null {
  if (typeof className !== "string") return null;
  const match = /language-(\S+)/.exec(className);
  return match?.[1] ?? null;
}

function getCodeBlockText(children: unknown): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(getCodeBlockText).join("");
  if (isValidElement<{ children?: unknown }>(children)) {
    return getCodeBlockText(children.props.children);
  }
  return String(children ?? "");
}

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
    pre: ({ children, ...props }) => {
      if (isValidElement<{ className?: string; children?: unknown }>(children)) {
        const language = getCodeBlockLanguage(children.props.className);
        if (language === "mermaid") {
          const chart = getCodeBlockText(children.props.children).replace(/\n$/, "");
          return (
            <div className="not-prose">
              <BlogMermaid chart={chart} />
            </div>
          );
        }
      }

      return <pre {...props}>{children}</pre>;
    },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
