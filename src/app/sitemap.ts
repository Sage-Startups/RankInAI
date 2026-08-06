import type { MetadataRoute } from 'next';

import { appUrl } from '@/lib/site-config';
import { LEGAL_SLUGS } from '@/lib/legal-content';

/**
 * Public sitemap. Authenticated, admin and buyer-preview routes are excluded
 * deliberately — they must never be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();

  const routes: Array<{
    path: string;
    priority: number;
    frequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  }> = [
    { path: '/', priority: 1, frequency: 'weekly' },
    { path: '/pricing', priority: 0.9, frequency: 'weekly' },
    { path: '/how-it-works', priority: 0.8, frequency: 'monthly' },
    { path: '/features', priority: 0.8, frequency: 'monthly' },
    { path: '/sample-report', priority: 0.8, frequency: 'monthly' },
    { path: '/demo', priority: 0.8, frequency: 'monthly' },
    { path: '/about', priority: 0.5, frequency: 'monthly' },
    { path: '/contact', priority: 0.5, frequency: 'monthly' },
    { path: '/signup', priority: 0.6, frequency: 'monthly' },
    { path: '/signin', priority: 0.4, frequency: 'monthly' },
  ];

  const legal = LEGAL_SLUGS.map((slug) => ({
    path: `/legal/${slug}`,
    priority: 0.3,
    frequency: 'yearly' as const,
  }));

  return [...routes, ...legal].map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.frequency,
    priority: route.priority,
  }));
}
