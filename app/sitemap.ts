import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://oarmour.com', lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: 'https://oarmour.com/v2', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://oarmour.com/signin', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ];
}
