import { z } from 'zod';

/**
 * Centralized, validated environment access.
 *
 * Rules enforced here:
 *  - production refuses to boot with a missing/weak AUTH_SECRET
 *  - production refuses to boot with the crawler test-fixture bypass enabled
 *  - production refuses billing test mode unless explicitly overridden
 *
 * Only server code may import this module.
 */

const booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    if (!v) return false;
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  });

const intFromString = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return fallback;
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  AUTH_SECRET: z.string().optional(),
  AUTH_TRUST_HOST: booleanish,
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  SUPER_ADMIN_EMAIL: z.string().email().default('admin@rankinai.com'),
  SUPER_ADMIN_SEED_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ONE_TIME_AUDIT: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_GROWTH_MONTHLY: z.string().optional(),
  STRIPE_PRICE_AGENCY_MONTHLY: z.string().optional(),
  BILLING_TEST_MODE: booleanish,
  BILLING_TEST_MODE_ALLOW_PRODUCTION: booleanish,

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_BASE_URL: z.string().url().default('https://api.openai.com/v1'),

  SEARCH_PROVIDER: z.enum(['none', 'serper']).default('none'),
  SERPER_API_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_FROM: z.string().default('RankInAI <no-reply@rankinai.com>'),
  EMAIL_PROVIDER_API_KEY: z.string().optional(),
  SUPPORT_EMAIL: z.string().default('support@rankinai.com'),

  CRON_SECRET: z.string().optional(),
  AUDIT_WORKER_SECRET: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: intFromString(4000),
  WORKER_CONCURRENCY: intFromString(1),
  WORKER_ID: z.string().optional(),

  CRAWL_TIMEOUT_MS: intFromString(15000),
  CRAWL_MAX_BYTES: intFromString(3_000_000),
  CRAWL_MAX_REDIRECTS: intFromString(5),
  CRAWL_DELAY_MS: intFromString(400),
  CRAWL_USER_AGENT: z
    .string()
    .default('RankInAI-Auditor/1.0 (+https://rankinai.com/crawler)'),

  ALLOW_TEST_FIXTURE_HOST: z.string().optional(),
  TEST_FIXTURE_ORIGIN: z.string().optional(),

  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_ENABLED: booleanish,
});

export type AppEnv = z.infer<typeof schema> & {
  isProduction: boolean;
  isTest: boolean;
  isDevelopment: boolean;
  billingTestMode: boolean;
  llmEnabled: boolean;
  searchEnabled: boolean;
  stripeConfigured: boolean;
  authSecret: string;
};

let cached: AppEnv | null = null;

function build(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const raw = parsed.data;
  const isProduction = raw.NODE_ENV === 'production';
  const isTest = raw.NODE_ENV === 'test';

  // AUTH_SECRET: mandatory and non-trivial in production.
  let authSecret = raw.AUTH_SECRET ?? '';
  if (isProduction) {
    if (!authSecret || authSecret.length < 32) {
      throw new Error(
        'AUTH_SECRET must be set to at least 32 characters in production. Generate one with: openssl rand -base64 48',
      );
    }
    if (authSecret.startsWith('replace-me')) {
      throw new Error('AUTH_SECRET still holds the placeholder value from .env.example.');
    }
  } else if (!authSecret) {
    // Deterministic, clearly-marked development fallback so `next dev` and the
    // test suite work without manual setup. Never reachable in production.
    authSecret = 'rankinai-development-only-secret-do-not-use-in-production';
  }

  // `next build` runs with NODE_ENV=production while still reading the
  // developer's local .env. The bypass is only dangerous when a request is
  // actually served, so the hard failure is scoped to runtime — a build is
  // allowed to proceed with a warning.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  // The crawler fixture bypass would be an SSRF hole in production.
  if (isProduction && raw.ALLOW_TEST_FIXTURE_HOST) {
    if (isBuildPhase) {
      console.warn(
        '[rankinai] WARNING: ALLOW_TEST_FIXTURE_HOST is set during a production build. It must NOT be set in the deployed environment — the server will refuse to start with it present.',
      );
    } else {
      throw new Error(
        'ALLOW_TEST_FIXTURE_HOST must not be set in production — it relaxes SSRF protection for the crawler.',
      );
    }
  }

  // Billing test mode must never silently activate in production.
  let billingTestMode = raw.BILLING_TEST_MODE === true;
  if (isProduction && billingTestMode && raw.BILLING_TEST_MODE_ALLOW_PRODUCTION !== true) {
    if (isBuildPhase) {
      console.warn(
        '[rankinai] WARNING: BILLING_TEST_MODE is set during a production build. Unset it in the deployed environment, or set BILLING_TEST_MODE_ALLOW_PRODUCTION=true — the server will refuse to start otherwise.',
      );
    } else {
      throw new Error(
        'BILLING_TEST_MODE is enabled in production. Unset it, or set BILLING_TEST_MODE_ALLOW_PRODUCTION=true to acknowledge that no real payments will be taken.',
      );
    }
  }

  const stripeConfigured = Boolean(raw.STRIPE_SECRET_KEY);
  if (!stripeConfigured && !billingTestMode) {
    // Without Stripe keys the only usable path is the simulated checkout.
    billingTestMode = !isProduction;
  }

  return {
    ...raw,
    authSecret,
    isProduction,
    isTest,
    isDevelopment: raw.NODE_ENV === 'development',
    billingTestMode,
    stripeConfigured,
    llmEnabled: Boolean(raw.OPENAI_API_KEY),
    searchEnabled: raw.SEARCH_PROVIDER === 'serper' && Boolean(raw.SERPER_API_KEY),
  };
}

export function getEnv(): AppEnv {
  if (!cached) cached = build();
  return cached;
}

/** Test helper: forget the memoized snapshot after mutating process.env. */
export function resetEnvCache(): void {
  cached = null;
}

export const env = new Proxy({} as AppEnv, {
  get(_t, prop: string) {
    return getEnv()[prop as keyof AppEnv];
  },
});
