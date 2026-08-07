import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://realtime.app', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://realtime.app/v2', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://realtime.app/signin', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ];
}
