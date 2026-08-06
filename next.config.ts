import type { NextConfig } from 'next';

/**
 * Content Security Policy.
 *
 * Stripe requires js.stripe.com for Checkout redirects and the embedded
 * elements bundle, plus frames for 3DS challenges. Everything else is
 * locked to same-origin.
 */
/**
 * The relaxations below exist for the webpack dev server, which serves modules
 * through `eval` and talks to the client over a websocket. Keying them off
 * "not production" rather than "development" matters: the E2E suite runs
 * `next dev` with NODE_ENV=test, and a CSP without 'unsafe-eval' silently
 * stops every client component from hydrating. Production keeps the strict
 * policy, which is the part that matters.
 */
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; 'unsafe-inline' is required for
  // the framework runtime. 'unsafe-eval' is only enabled in development for
  // React Refresh.
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ''} https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://api.stripe.com${isDev ? ' ws: http://localhost:*' : ''}`,
  'frame-src https://js.stripe.com https://hooks.stripe.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self "https://js.stripe.com")',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  // Railway deploys the standalone server bundle produced by `next build`.
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: ['pdfkit', 'bcryptjs'],
  eslint: {
    dirs: ['src', 'tests', 'scripts', 'prisma'],
  },
  typedRoutes: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // The buyer-preview page must never be indexed.
        source: '/business-snapshot',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }],
      },
    ];
  },
};

export default nextConfig;
