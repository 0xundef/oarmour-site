import { MetadataRoute } from 'next';
import fs from 'fs';
import path from 'path';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: 'https://oarmour.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://oarmour.com/signin',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: 'https://oarmour.com/blog',
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];

  try {
    const blogDir = path.join(process.cwd(), 'content', 'blog');
    if (fs.existsSync(blogDir)) {
      const files = fs.readdirSync(blogDir);
      for (const file of files) {
        if (file.endsWith('.mdx')) {
          const slug = file.replace(/\.mdx$/, '');
          entries.push({
            url: `https://oarmour.com/blog/${slug}`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }
      }
    }
  } catch {
    // ignore fs errors
  }

  return entries;
}
