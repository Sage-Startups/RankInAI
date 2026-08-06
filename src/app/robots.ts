import type { MetadataRoute } from 'next';

import { appUrl } from '@/lib/site-config';

/**
 * robots.txt.
 *
 * Public marketing pages are open to every crawler, including named AI agents —
 * this product would be poorly placed to argue for AI accessibility while
 * blocking it. Authenticated, admin, API and buyer-preview routes are excluded.
 */
export default function robots(): MetadataRoute.Robots {
  const base = appUrl();

  const disallow = [
    '/api/',
    '/dashboard/',
    '/admin/',
    '/onboarding',
    '/checkout/',
    '/business-snapshot',
    '/reset-password',
    '/verify-email',
    '/auth-error',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow,
      },
      // Named AI crawlers are explicitly welcome on the public marketing pages.
      {
        userAgent: [
          'GPTBot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'ClaudeBot',
          'Google-Extended',
        ],
        allow: '/',
        disallow,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
